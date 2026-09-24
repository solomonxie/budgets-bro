import { Share } from 'react-native';
import JSZip from 'jszip';
import type { SQLiteDatabase } from '../db/driver';
import type { Board } from '../domain/types';
import { cacheDir, fileUrl, joinPath, removePath, writeBytes } from '../files/fileStore';
import { buildBackupZip } from '../sync/buildBackup';
import { slugifyBoardName } from '../sync/backupPath';

export async function exportAllBoardsZip(db: SQLiteDatabase, boards: Board[]): Promise<boolean> {
  const archive = new JSZip();
  for (const board of boards) {
    const name = slugifyBoardName(board.name) || `board-${board.id}`;
    const bytes = await buildBackupZip(db, board.id, board.name);
    archive.file(`boards/${board.id}-${name}.zip`, bytes);
  }
  archive.file(
    'README.txt',
    'Each file in boards/ is a standard Budgets Bro board export. Extract a board ZIP and restore it from Settings → Data → Import a backup.\n',
  );
  const bytes = await archive.generateAsync({ type: 'uint8array' });
  const path = joinPath(cacheDir, `budgets-bro-app-data-${Date.now()}.zip`);
  await writeBytes(path, bytes);
  try {
    const result = await Share.share({ url: fileUrl(path) });
    return result.action === Share.sharedAction;
  } finally {
    await removePath(path);
  }
}
