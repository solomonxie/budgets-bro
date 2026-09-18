import type { SQLiteDatabase } from 'expo-sqlite';

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

// A rate change has a reason — a promo period ending, a fixed term rolling
// onto a variable one, a central-bank move — and the percentage alone doesn't
// carry it. Same nullable TEXT `note` the other histories already have
// (migrations 019, 023).
export async function up(db: SQLiteDatabase): Promise<void> {
  if (await hasColumn(db, 'account_rate_history', 'note')) return;
  await db.execAsync('ALTER TABLE account_rate_history ADD COLUMN note TEXT;');
}
