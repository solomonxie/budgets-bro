import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

// Raw table dumps (not the mapped camelCase domain types) — a lossless
// backup is more useful here than a "clean" export, and every board-owned
// table follows the same board_id-scoped shape.
const TABLES = ['accounts', 'category_groups', 'categories', 'budget_entries', 'payees', 'transactions'] as const;

async function dumpTable(db: SQLiteDatabase, table: (typeof TABLES)[number], boardId: number): Promise<unknown[]> {
  return db.getAllAsync(`SELECT * FROM ${table} WHERE board_id = ?`, boardId);
}

// Builds the zip and hands it to the OS share sheet so the user picks where
// to save it — async because zipping + writing a potentially large export
// shouldn't block the UI thread's next frame.
export async function exportBoardZip(db: SQLiteDatabase, boardId: number, boardName: string): Promise<void> {
  const zip = new JSZip();
  for (const table of TABLES) {
    const rows = await dumpTable(db, table, boardId);
    zip.file(`${table}.json`, JSON.stringify(rows, null, 2));
  }
  zip.file(
    'manifest.json',
    JSON.stringify({ boardId, boardName, exportedAt: new Date().toISOString() }, null, 2),
  );

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const safeName = boardName.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'board';
  const file = new File(Paths.cache, `${safeName}-export-${Date.now()}.zip`);
  file.create();
  file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', UTI: 'public.zip-archive' });
  }
}
