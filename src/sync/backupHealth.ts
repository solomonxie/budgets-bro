import type { SQLiteDatabase } from '../db/driver';
import * as changeLogRepo from '../db/repositories/changeLogRepo';
import { enabledProviders, getLastSyncedAt, getLastSyncedSeq } from './cloudSync';
import { ICLOUD_PROVIDER_ID } from './icloudProvider';
import { listS3Configs } from './s3Provider';

// Changes waiting longer than this without reaching any off-device copy are
// worth a word on the Budget page. Sync runs daily whenever the app is open,
// so this only trips when something is actually failing.
const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = 3 * DAY_MS;

export type BackupHealth =
  // Nothing off this iPhone at all: no destination on, or none reachable.
  | { kind: 'none'; hasData: boolean }
  | { kind: 'ok' | 'stale'; lastSyncedAt: string | null; daysSince: number | null; destinations: string[] };

export async function getBackupHealth(db: SQLiteDatabase, icloudLabel: string): Promise<BackupHealth> {
  const seq = await changeLogRepo.latestChangeSeq(db);
  const providers = await enabledProviders(db);
  if (providers.length === 0) return { kind: 'none', hasData: seq > 0 };

  const buckets = new Map((await listS3Configs(db)).map((c) => [`aws-s3:${c.id}`, c.bucket]));
  let lastSyncedAt: string | null = null;
  let syncedSeq = -1;
  for (const p of providers) {
    const at = await getLastSyncedAt(db, p.id);
    if (at != null && (lastSyncedAt == null || at > lastSyncedAt)) lastSyncedAt = at;
    syncedSeq = Math.max(syncedSeq, (await getLastSyncedSeq(db, p.id)) ?? -1);
  }
  const pending = seq > syncedSeq;
  const age = lastSyncedAt == null ? null : Date.now() - new Date(lastSyncedAt).getTime();
  return {
    kind: pending && (age == null || age > STALE_AFTER_MS) ? 'stale' : 'ok',
    lastSyncedAt,
    daysSince: age == null ? null : Math.floor(age / DAY_MS),
    destinations: providers.map((p) => (p.id === ICLOUD_PROVIDER_ID ? icloudLabel : (buckets.get(p.id) ?? p.id))),
  };
}
