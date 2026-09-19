import type { SQLiteDatabase } from '../db/driver';
import { cacheDir, fileUrl, joinPath, writeBytes } from '../files/fileStore';
import { Share } from 'react-native';
import { buildBackupZip } from '../sync/buildBackup';
import { slugifyBoardName } from '../sync/backupPath';

// Builds the zip and hands it to the OS share sheet so the user picks where
// to save it — async because zipping + writing a potentially large export
// shouldn't block the UI thread's next frame.
export async function exportBoardZip(db: SQLiteDatabase, boardId: number, boardName: string): Promise<void> {
  const bytes = await buildBackupZip(db, boardId, boardName);
  const safeName = slugifyBoardName(boardName);
  const path = joinPath(cacheDir, `${safeName}-export-${Date.now()}.zip`);
  await writeBytes(path, bytes);

  // iOS takes a file:// url straight: the share sheet reads the UTI off the
  // extension, so the zip offers Files, Mail, AirDrop as before.
  await Share.share({ url: fileUrl(path) });
}
