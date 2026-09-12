import type { SQLiteDatabase } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import * as settingsRepo from '../db/repositories/settingsRepo';
import type { CloudProvider } from './types';

const ENABLED_KEY = 'sync_local_enabled';
const BACKUP_DIR_NAME = 'backups';

// Documents (not cache) — survives app relaunches, and since nothing marks
// it excluded-from-backup, it rides along in the user's normal encrypted
// device backup (iCloud or Finder/iTunes) automatically. Visible in the iOS
// Files app under "On My iPhone" once UIFileSharingEnabled ships via the
// expo-file-system plugin config in app.json — that flag only takes effect
// in a real build/dev-client, not Expo Go.
function backupDir(): Directory {
  return new Directory(Paths.document, BACKUP_DIR_NAME);
}

// fileName is `<boardId>/latest.zip` (same convention as s3Provider) — the
// boardId segment becomes a real subdirectory here, created on demand.
function resolveFile(fileName: string): File {
  const parts = fileName.split('/');
  const name = parts.pop()!;
  const dir = parts.reduce((d, part) => new Directory(d, part), backupDir());
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, name);
}

export async function isLocalBackupEnabled(db: SQLiteDatabase): Promise<boolean> {
  return (await settingsRepo.getSetting(db, ENABLED_KEY)) === 'true';
}

export async function setLocalBackupEnabled(db: SQLiteDatabase, enabled: boolean): Promise<void> {
  await settingsRepo.setSetting(db, ENABLED_KEY, enabled ? 'true' : 'false');
}

// Shown in Settings so the path is inspectable (e.g. in the simulator via
// Finder, or `xcrun simctl get_app_container`) without guessing at it.
export function localBackupDirUri(): string {
  return backupDir().uri;
}

function toProvider(): CloudProvider {
  return {
    id: 'local',
    async upload(bytes, fileName) {
      const file = resolveFile(fileName);
      if (file.exists) file.delete();
      file.create();
      file.write(bytes);
    },
    async downloadLatest(fileName) {
      const file = resolveFile(fileName);
      return file.exists ? file.bytes() : null;
    },
  };
}

export async function createLocalProviders(db: SQLiteDatabase): Promise<CloudProvider[]> {
  return (await isLocalBackupEnabled(db)) ? [toProvider()] : [];
}
