import type { SQLiteDatabase } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import * as settingsRepo from '../db/repositories/settingsRepo';
import type { CloudProvider } from './types';

const ENABLED_KEY = 'sync_local_enabled';
const BACKUP_DIR_NAME = 'backups';

// Documents (not cache) — survives app relaunches. Not a hedge against
// losing/replacing the phone or deleting the app, though: expo-sqlite's own
// database already lives at Documents/SQLite/, the same sandbox this zip
// sits in, so both disappear together on app deletion and both get restored
// together by a full device restore either way — this doesn't add off-
// device coverage the live DB didn't already have. Its actual job is a
// rollback snapshot (undo a bad import, recover from DB corruption) plus a
// manually-retrievable file — visible in the iOS Files app under "On My
// iPhone" once UIFileSharingEnabled ships via the expo-file-system plugin
// config in app.json, though that flag only takes effect in a real
// build/dev-client, not Expo Go. Real off-device backup is s3Provider.ts.
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
