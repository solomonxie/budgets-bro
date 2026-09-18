import type { SQLiteDatabase } from '../db/driver';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { downloadLatestBackup } from './cloudSync';
import { ICLOUD_PROVIDER_ID, isICloudSupported } from './icloudProvider';
import { parseBackupZip } from './parseBackupZip';
import { importAppExport } from '../import/appExportImporter';

const DONE_KEY = 'icloud_auto_restore_done';

// Deleting the app takes the database with it, which is why the on-device
// backup destination was removed: it lived in the same sandbox and died
// alongside the thing it was protecting. iCloud outlives a reinstall, so a
// fresh install pulls its own board back
// without being asked: that is the entire point of having backed it up, and
// a prompt on first launch asks a question the user can't yet have context
// for. "Import a backup" stays the manual override for everything else.
//
// Once only, and only into an install with nothing to lose. A board name is
// needed to pick the right backup out of the folder, which on a fresh
// install is whatever name the seeded board carries.
export async function restoreFromICloudIfFirstRun(
  db: SQLiteDatabase,
  boardId: number,
  boardName: string,
): Promise<boolean> {
  if (!isICloudSupported()) return false;
  if (await settingsRepo.getSetting(db, DONE_KEY)) return false;
  // Whatever happens below, don't try again: a second run would restore a
  // duplicate board, and a failure here is not worth retrying forever.
  await settingsRepo.setSetting(db, DONE_KEY, '1');

  try {
    const bytes = await downloadLatestBackup(
      db,
      boardId,
      boardName,
      ICLOUD_PROVIDER_ID,
    );
    if (!bytes) return false;
    await importAppExport(db, await parseBackupZip(bytes));
    return true;
  } catch (e) {
    console.warn('[autoRestore] iCloud restore failed', e);
    return false;
  }
}
