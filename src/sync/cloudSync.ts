import type { SQLiteDatabase } from '../db/driver';
import * as settingsRepo from '../db/repositories/settingsRepo';
import * as changeLogRepo from '../db/repositories/changeLogRepo';
import { buildBackupZip } from './buildBackup';
import { createS3Providers } from './s3Provider';
import { createICloudProviders } from './icloudProvider';
import { backupKey, staleBackupKeys } from './backupPath';
import { currentDateISO } from '../domain/month';
import { resolveSyncEnabled } from './autoSync';
import type { CloudProvider, CloudProviderId } from './types';

const SYNC_PREFIX = 'sync_auto_';
// The two settings this one switch replaced — see autoSync.ts.
const LEGACY_GLOBAL_KEY = 'sync_auto_enabled';
const LAST_SYNCED_PREFIX = 'sync_last_synced_';

// Every switch's setting key, the legacy global one included — what a wipe
// keeps so a destination switched off doesn't come back on.
export function syncSwitchKeys(providerIds: CloudProviderId[]): string[] {
  return [LEGACY_GLOBAL_KEY, ...providerIds.map((id) => `${SYNC_PREFIX}${id}`)];
}

// Every destination starts on. Adding an S3 connection is itself the opt-in;
// iCloud has no such moment, and used to start off so an update wouldn't
// write into someone's iCloud uninvited — but off meant an install with no
// bucket configured kept every copy inside the app sandbox, where deleting
// the app takes the ledger with it. A backup nobody switched on is the
// failure this app exists to avoid, and the switch is still right there.
function startsOn(_providerId: CloudProviderId): boolean {
  return true;
}

export async function isSyncEnabled(
  db: SQLiteDatabase,
  providerId: CloudProviderId,
): Promise<boolean> {
  return resolveSyncEnabled(
    await settingsRepo.getSetting(db, `${SYNC_PREFIX}${providerId}`),
    null,
    await settingsRepo.getSetting(db, LEGACY_GLOBAL_KEY),
    startsOn(providerId),
  );
}

export async function setSyncEnabled(
  db: SQLiteDatabase,
  providerId: CloudProviderId,
  enabled: boolean,
): Promise<void> {
  await settingsRepo.setSetting(
    db,
    `${SYNC_PREFIX}${providerId}`,
    enabled ? 'true' : 'false',
  );
}

export async function getLastSyncedAt(
  db: SQLiteDatabase,
  providerId: CloudProviderId,
): Promise<string | null> {
  return settingsRepo.getSetting(db, `${LAST_SYNCED_PREFIX}${providerId}`);
}

async function setLastSyncedAt(
  db: SQLiteDatabase,
  providerId: CloudProviderId,
  iso: string,
): Promise<void> {
  await settingsRepo.setSetting(db, `${LAST_SYNCED_PREFIX}${providerId}`, iso);
}

// Every destination that physically exists, switched on or not — restore
// reads through here too, and a destination you stopped syncing to still
// holds the backups it already took.
// New providers (Google Drive, etc.) just add another `create*Providers(db)`
// call — see docs/design/cloud-sync/DESIGN.md.
async function collectProviders(db: SQLiteDatabase): Promise<CloudProvider[]> {
  const [s3, icloud] = await Promise.all([
    createS3Providers(db),
    createICloudProviders(),
  ]);
  return [...s3, ...icloud];
}

export interface SyncOutcome {
  providerId: CloudProviderId;
  syncedAt: string | null;
  error: string | null;
}

// One-way backup to every destination whose switch is on — not a merge (see
// DESIGN.md Non-goals). There is no manual trigger and no per-destination
// call: a switch that's on means "every change", which is the whole of what
// the setting promises. Failures are returned rather than thrown — a sync
// hiccup must never interrupt money entry.
// A day, and only if something actually changed since the last one.
//
// Every edit used to push a whole zip, which is a lot of upload for moving a
// transaction between categories, and on a destination keeping a file per
// month it rewrote the same object dozens of times a day. The change log's
// high-water mark makes "has anything changed" a single integer comparison
// (see changeLogRepo.latestChangeSeq) rather than a diff.
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LAST_SEQ_PREFIX = 'cloud_last_seq_';

async function isBackupDue(db: SQLiteDatabase, providerId: string, currentSeq: number): Promise<boolean> {
  const storedSeq = await settingsRepo.getSetting(db, `${LAST_SEQ_PREFIX}${providerId}`);
  if (storedSeq != null && Number(storedSeq) === currentSeq) return false;
  const lastSyncedAt = await getLastSyncedAt(db, providerId);
  if (lastSyncedAt == null) return true;
  return Date.now() - new Date(lastSyncedAt).getTime() >= BACKUP_INTERVAL_MS;
}

// Runs a backup only where one is due — what the automatic sync calls on
// every change. `syncNow` itself stays unconditional, because a user tapping
// Back Up Now means now.
export async function syncIfDue(
  db: SQLiteDatabase,
  boardId: number,
  boardName: string,
): Promise<SyncOutcome[]> {
  const currentSeq = await changeLogRepo.latestChangeSeq(db);
  const all = await collectProviders(db);
  const due = (
    await Promise.all(
      all.map(async (p) =>
        (await isSyncEnabled(db, p.id)) && (await isBackupDue(db, p.id, currentSeq)) ? p : null,
      ),
    )
  ).filter((p): p is CloudProvider => p != null);
  if (due.length === 0) return [];
  return upload(db, boardId, boardName, due, currentSeq);
}

export async function syncNow(
  db: SQLiteDatabase,
  boardId: number,
  boardName: string,
): Promise<SyncOutcome[]> {
  const all = await collectProviders(db);
  const eligible = (
    await Promise.all(
      all.map(async (p) => ((await isSyncEnabled(db, p.id)) ? p : null)),
    )
  ).filter((p): p is CloudProvider => p != null);
  if (eligible.length === 0) return [];
  return upload(db, boardId, boardName, eligible, await changeLogRepo.latestChangeSeq(db));
}

async function upload(
  db: SQLiteDatabase,
  boardId: number,
  boardName: string,
  providers: CloudProvider[],
  atSeq: number,
): Promise<SyncOutcome[]> {
  const bytes = await buildBackupZip(db, boardId, boardName);
  // Built once and written under the same name everywhere — one object per
  // board per day. Destinations differ in what they keep, not what they call
  // it (see backupPath.ts and CloudProvider.keepLatest).
  const key = backupKey(boardName, currentDateISO());
  return Promise.all(
    providers.map(async (provider) => {
      try {
        await provider.upload(bytes, key);
        const syncedAt = new Date().toISOString();
        await prune(provider, boardName);
        await setLastSyncedAt(db, provider.id, syncedAt);
        // Recorded only on success, so a failed upload leaves the next
        // change still looking overdue rather than silently skipped.
        await settingsRepo.setSetting(db, `${LAST_SEQ_PREFIX}${provider.id}`, String(atSeq));
        return { providerId: provider.id, syncedAt, error: null };
      } catch (e) {
        console.warn(`[cloudSync] ${provider.id} upload failed`, e);
        return {
          providerId: provider.id,
          syncedAt: null,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }),
  );
}

// Files under their own names to every destination that's switched on — no
// pruning, no sync bookkeeping. backupPath only recognises dated keys, so
// these are never pruned or picked as a board's latest.
export async function uploadNamedBackups(
  db: SQLiteDatabase,
  files: { name: string; bytes: Uint8Array }[],
): Promise<SyncOutcome[]> {
  const providers = await collectProviders(db);
  const enabled = await Promise.all(providers.map((p) => isSyncEnabled(db, p.id)));
  return Promise.all(
    providers
      .filter((_, i) => enabled[i])
      .map(async (provider) => {
        try {
          for (const file of files) await provider.upload(file.bytes, file.name);
          return { providerId: provider.id, syncedAt: new Date().toISOString(), error: null };
        } catch (e) {
          console.warn(`[cloudSync] ${provider.id} upload failed`, e);
          return { providerId: provider.id, syncedAt: null, error: e instanceof Error ? e.message : String(e) };
        }
      }),
  );
}

// After the upload, never before: a prune that runs first can delete the
// last good copy and then fail to replace it. Failures here are swallowed on
// purpose — the backup is already up, and a destination that won't let us
// delete (a write-only bucket, an iCloud file open elsewhere) is not a failed
// backup. It just keeps more history than asked.
async function prune(provider: CloudProvider, boardName: string): Promise<void> {
  if (provider.keepLatest == null || provider.remove == null) return;
  try {
    const stale = staleBackupKeys(await provider.listKeys(), boardName, provider.keepLatest);
    for (const key of stale) await provider.remove(key);
  } catch (e) {
    console.warn(`[cloudSync] ${provider.id} prune failed`, e);
  }
}
