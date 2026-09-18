import type { SQLiteDatabase } from '../../src/db/driver';

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

// Free-text notes: one per account ("offset mortgage, ends 2041", which
// branch a card is with), one per logged value entry ("Zillow estimate",
// "post-renovation appraisal") — a number on its own loses why it changed.
// Same nullable TEXT `note` as income_detail_history already carries
// (migration 019).
export async function up(db: SQLiteDatabase): Promise<void> {
  if (!(await hasColumn(db, 'accounts', 'note'))) {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN note TEXT;');
  }
  if (!(await hasColumn(db, 'account_value_history', 'note'))) {
    await db.execAsync('ALTER TABLE account_value_history ADD COLUMN note TEXT;');
  }
}
