import type { SQLiteDatabase } from '../db/driver';
import type { Board } from '../domain/types';
import { buildBackupZip } from '../sync/buildBackup';
import { uploadNamedBackups } from '../sync/cloudSync';
import { writeLocalBackupBytes } from './localBackup';
import { preDeletionBackupName } from './localBackupName';

// Before Remove all app data: every board to the Backups folder, then to
// each cloud destination that's on. A failed local write throws, so nothing
// is deleted without a copy; a failed upload doesn't — being offline must
// not block the wipe.
export async function backUpBeforeDeletion(db: SQLiteDatabase, boards: Board[], at = new Date()): Promise<void> {
  const files: { name: string; bytes: Uint8Array }[] = [];
  for (const board of boards) {
    let name = preDeletionBackupName(board.name, at);
    // Two boards with the same slug must not overwrite each other.
    if (files.some((f) => f.name === name)) name = preDeletionBackupName(`${board.name}-${board.id}`, at);
    const bytes = await buildBackupZip(db, board.id, board.name);
    await writeLocalBackupBytes(name, bytes);
    files.push({ name, bytes });
  }
  await uploadNamedBackups(db, files);
}
