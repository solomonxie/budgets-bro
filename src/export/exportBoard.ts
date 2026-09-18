import type { SQLiteDatabase } from '../db/driver';
import { File, Paths } from 'expo-file-system';
import { Share } from 'react-native';
import { buildBackupZip } from '../sync/buildBackup';
import { slugifyBoardName } from '../sync/backupPath';

// Builds the zip and hands it to the OS share sheet so the user picks where
// to save it — async because zipping + writing a potentially large export
// shouldn't block the UI thread's next frame.
export async function exportBoardZip(db: SQLiteDatabase, boardId: number, boardName: string): Promise<void> {
  const bytes = await buildBackupZip(db, boardId, boardName);
  const safeName = slugifyBoardName(boardName);
  const file = new File(Paths.cache, `${safeName}-export-${Date.now()}.zip`);
  file.create();
  file.write(bytes);

  // iOS takes a file:// url straight: the share sheet reads the UTI off the
  // extension, so the zip offers Files, Mail, AirDrop as before.
  await Share.share({ url: file.uri });
}
