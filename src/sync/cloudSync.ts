import type { SQLiteDatabase } from 'expo-sqlite';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { buildBackupZip } from './buildBackup';
import { createS3Providers } from './s3Provider';
import { createICloudProviders } from './icloudProvider';
import { LEGACY_BACKUP_KEY, latestBackupKey } from './backupPath';
import { currentDateISO } from '../domain/month';
import { resolveSyncEnabled } from './autoSync';
import type { CloudProvider, CloudProviderId } from './types';

const SYNC_PREFIX = 'sync_auto_';
// The two settings this one switch replaced — see autoSync.ts.
const LEGACY_GLOBAL_KEY = 'sync_auto_enabled';
const LAST_SYNCED_PREFIX = 'sync_last_synced_';

// Adding an S3 connection is itself the opt-in, so it starts on. iCloud has
// no such moment, so it starts off: installing an update shouldn't begin
// writing into someone's iCloud uninvited.
function startsOn(providerId: CloudProviderId): boolean {
  return providerId.startsWith('aws-s3:');
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

  const bytes = await buildBackupZip(db, boardId, boardName);
  // Built once, but keyed per destination: a bucket keeps one object per
  // board per month, iCloud overwrites its single file — see backupPath.ts.
  const today = currentDateISO();
  return Promise.all(
    eligible.map(async (provider) => {
      try {
        await provider.upload(bytes, provider.keyFor(boardName, today));
        const syncedAt = new Date().toISOString();
        await setLastSyncedAt(db, provider.id, syncedAt);
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

// Used by the automatic post-reinstall restore (sync/autoRestore.ts), which
// is the only restore path that reads a destination — everything manual goes
// through "Import a backup" and a file the user picked.
export async function downloadLatestBackup(
  db: SQLiteDatabase,
  boardId: number,
  boardName: string,
  providerId: CloudProviderId,
): Promise<Uint8Array | null> {
  const provider = (await collectProviders(db)).find(
    (p) => p.id === providerId,
  );
  if (!provider) return null;
  try {
    const key = latestBackupKey(await provider.listKeys(), boardName);
    if (key) {
      const bytes = await provider.download(key);
      if (bytes) return bytes;
    }
  } catch (e) {
    console.warn(`[cloudSync] ${provider.id} list failed`, e);
  }
  // Anyone who backed up before keys were dated still has exactly one file
  // at the old path, and it may be their only copy.
  return provider.download(LEGACY_BACKUP_KEY(boardId));
}
