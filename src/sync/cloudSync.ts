import type { SQLiteDatabase } from 'expo-sqlite';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { buildBackupZip } from './buildBackup';
import { createS3Providers } from './s3Provider';
import { createLocalProviders } from './localProvider';
import { LEGACY_BACKUP_KEY, backupKey, latestBackupKey } from './backupPath';
import { currentDateISO } from '../domain/month';
import { resolveAutoSync } from './autoSync';
import type { CloudProvider, CloudProviderId } from './types';

// Auto-sync is per destination, not one global switch: "back up to the bucket
// automatically, write the on-device snapshot only when I ask" is an ordinary
// thing to want, and a single toggle can't say it.
const AUTO_SYNC_PREFIX = 'sync_auto_';
// The single switch this replaced — see autoSync.ts for how it's inherited.
const LEGACY_AUTO_SYNC_KEY = 'sync_auto_enabled';
const LAST_SYNCED_PREFIX = 'sync_last_synced_';

export async function isAutoSyncEnabled(db: SQLiteDatabase, providerId: CloudProviderId): Promise<boolean> {
  return resolveAutoSync(
    await settingsRepo.getSetting(db, `${AUTO_SYNC_PREFIX}${providerId}`),
    await settingsRepo.getSetting(db, LEGACY_AUTO_SYNC_KEY),
  );
}

export async function setAutoSyncEnabled(db: SQLiteDatabase, providerId: CloudProviderId, enabled: boolean): Promise<void> {
  await settingsRepo.setSetting(db, `${AUTO_SYNC_PREFIX}${providerId}`, enabled ? 'true' : 'false');
}

export async function getLastSyncedAt(db: SQLiteDatabase, providerId: CloudProviderId): Promise<string | null> {
  return settingsRepo.getSetting(db, `${LAST_SYNCED_PREFIX}${providerId}`);
}

async function setLastSyncedAt(db: SQLiteDatabase, providerId: CloudProviderId, iso: string): Promise<void> {
  await settingsRepo.setSetting(db, `${LAST_SYNCED_PREFIX}${providerId}`, iso);
}

// New providers (Google Drive, etc.) just add another `create*Providers(db)`
// call here — see docs/design/cloud-sync/DESIGN.md.
async function collectProviders(db: SQLiteDatabase): Promise<CloudProvider[]> {
  const [s3, local] = await Promise.all([createS3Providers(db), createLocalProviders(db)]);
  return [...s3, ...local];
}

export async function hasAnyProviderConfigured(db: SQLiteDatabase): Promise<boolean> {
  return (await collectProviders(db)).length > 0;
}

export interface SyncOutcome {
  providerId: CloudProviderId;
  syncedAt: string | null;
  error: string | null;
}

export interface SyncOptions {
  // One destination only — what a connection's own "Sync Now" targets.
  providerId?: CloudProviderId;
  // Skip destinations whose auto-sync is off. Set by the background/debounced
  // path; a button press syncs regardless of the setting.
  autoOnly?: boolean;
}

// One-way backup to the selected destinations — not a merge (see DESIGN.md
// Non-goals). Failures are returned rather than thrown: a sync hiccup must
// never interrupt money entry, but a button press needs something to report.
export async function syncNow(
  db: SQLiteDatabase,
  boardId: number,
  boardName: string,
  options: SyncOptions = {},
): Promise<SyncOutcome[]> {
  const all = await collectProviders(db);
  const selected = options.providerId ? all.filter((p) => p.id === options.providerId) : all;
  const eligible = options.autoOnly
    ? (await Promise.all(selected.map(async (p) => ((await isAutoSyncEnabled(db, p.id)) ? p : null)))).filter(
        (p): p is CloudProvider => p != null,
      )
    : selected;
  if (eligible.length === 0) return [];

  const bytes = await buildBackupZip(db, boardId, boardName);
  // One object per board per day — syncing again the same day replaces it.
  const key = backupKey(boardName, currentDateISO());
  return Promise.all(
    eligible.map(async (provider) => {
      try {
        await provider.upload(bytes, key);
        const syncedAt = new Date().toISOString();
        await setLastSyncedAt(db, provider.id, syncedAt);
        return { providerId: provider.id, syncedAt, error: null };
      } catch (e) {
        console.warn(`[cloudSync] ${provider.id} upload failed`, e);
        return { providerId: provider.id, syncedAt: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

// For "Restore Latest" — scoped to one destination when a connection's own
// menu asks, otherwise the first provider holding a backup for this board.
export async function downloadLatestBackup(
  db: SQLiteDatabase,
  boardId: number,
  boardName: string,
  providerId?: CloudProviderId,
): Promise<Uint8Array | null> {
  const all = await collectProviders(db);
  const providers = providerId ? all.filter((p) => p.id === providerId) : all;
  for (const provider of providers) {
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
    const legacy = await provider.download(LEGACY_BACKUP_KEY(boardId));
    if (legacy) return legacy;
  }
  return null;
}
