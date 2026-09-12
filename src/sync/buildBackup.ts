import type { SQLiteDatabase } from 'expo-sqlite';
import JSZip from 'jszip';

// Raw table dumps (not the mapped camelCase domain types) — a lossless
// backup is more useful here than a "clean" export, and every board-owned
// table follows the same board_id-scoped shape.
const TABLES = ['accounts', 'category_groups', 'categories', 'budget_entries', 'payees', 'transactions'] as const;

async function dumpTable(db: SQLiteDatabase, table: (typeof TABLES)[number], boardId: number): Promise<unknown[]> {
  return db.getAllAsync(`SELECT * FROM ${table} WHERE board_id = ?`, boardId);
}

// Builds the same zip shape export/exportBoard.ts (share-sheet export) and
// every sync/*Provider.ts (cloud backup) both need — pure bytes in, no I/O
// beyond reading the db, so both callers layer their own destination
// (share sheet vs. HTTP upload) on top without duplicating the table dump.
export async function buildBackupZip(db: SQLiteDatabase, boardId: number, boardName: string): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const table of TABLES) {
    const rows = await dumpTable(db, table, boardId);
    zip.file(`${table}.json`, JSON.stringify(rows, null, 2));
  }
  zip.file('manifest.json', JSON.stringify({ boardId, boardName, exportedAt: new Date().toISOString() }, null, 2));

  return zip.generateAsync({ type: 'uint8array' });
}
