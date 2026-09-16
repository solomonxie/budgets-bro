import type { SQLiteDatabase } from 'expo-sqlite';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { buildBackupZip } from './buildBackup';
import { createS3Providers } from './s3Provider';
import { createLocalProviders } from './localProvider';
import { LEGACY_BACKUP_KEY, backupKey, latestBackupKey } from './backupPath';
import { currentDateISO } from '../domain/month';
import type { CloudProvider } from './types';

const AUTO_SYNC_KEY = 'sync_auto_enabled';
const LAST_SYNCED_PREFIX = 'sync_last_synced_';

export async function isAutoSyncEnabled(db: SQLiteDatabase): Promise<boolean> {
  return (await settingsRepo.getSetting(db, AUTO_SYNC_KEY)) !== 'false'; // defaults on once a provider is configured
}

export async function setAutoSyncEnabled(db: SQLiteDatabase, enabled: boolean): Promise<void> {
  await settingsRepo.setSetting(db, AUTO_SYNC_KEY, enabled ? 'true' : 'false');
}

export async function getLastSyncedAt(db: SQLiteDatabase, providerId: string): Promise<string | null> {
  return settingsRepo.getSetting(db, `${LAST_SYNCED_PREFIX}${providerId}`);
}

async function setLastSyncedAt(db: SQLiteDatabase, providerId: string, iso: string): Promise<void> {
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

// One summary line for Settings — the most recent sync across every
// currently configured provider, not a per-bucket breakdown.
export async function getLastSyncedSummary(db: SQLiteDatabase): Promise<string | null> {
  const providers = await collectProviders(db);
  const timestamps = await Promise.all(providers.map((p) => getLastSyncedAt(db, p.id)));
  const known = timestamps.filter((t): t is string => t != null).sort();
  return known[known.length - 1] ?? null;
}

// One-way backup to every configured provider — not a merge (see DESIGN.md
// Non-goals). Failures are logged, never thrown: a sync hiccup must never
// interrupt money entry.
export async function syncNow(db: SQLiteDatabase, boardId: number, boardName: string): Promise<void> {
  const providers = await collectProviders(db);
  if (providers.length === 0) return;
  const bytes = await buildBackupZip(db, boardId, boardName);
  // One object per board per day — syncing again the same day replaces it.
  const key = backupKey(boardName, currentDateISO());
  await Promise.all(
    providers.map(async (provider) => {
      try {
        await provider.upload(bytes, key);
        await setLastSyncedAt(db, provider.id, new Date().toISOString());
      } catch (e) {
        console.warn(`[cloudSync] ${provider.id} upload failed`, e);
      }
    }),
  );
}

// For "Restore Latest from Cloud" — tries providers in order, first hit
// wins (there's normally only one configured anyway).
export async function downloadLatestBackup(db: SQLiteDatabase, boardId: number, boardName: string): Promise<Uint8Array | null> {
  const providers = await collectProviders(db);
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
