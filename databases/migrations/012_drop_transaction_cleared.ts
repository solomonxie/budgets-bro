import type { SQLiteDatabase } from 'expo-sqlite';

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

// The "cleared" reconciliation flag never had a UI for filtering/reviewing
// by it — just an unused toggle on the transaction form — so it's dropped
// rather than carried forward. expo-sqlite's bundled SQLite is new enough
// (3.35+) for a direct DROP COLUMN, no table rebuild needed.
export async function up(db: SQLiteDatabase): Promise<void> {
  if (await hasColumn(db, 'transactions', 'cleared')) {
    await db.execAsync('ALTER TABLE transactions DROP COLUMN cleared;');
  }
}
