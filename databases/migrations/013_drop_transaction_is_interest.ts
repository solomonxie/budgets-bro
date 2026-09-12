import type { SQLiteDatabase } from 'expo-sqlite';

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

// Same story as 012_drop_transaction_cleared: recorded on every transaction
// (manually toggled, or auto-detected on YNAB import from an inflow whose
// category name contained "interest"), but nothing ever read it back out —
// no Tax Insights/Baby Steps/Insights consumer was ever built against it.
export async function up(db: SQLiteDatabase): Promise<void> {
  if (await hasColumn(db, 'transactions', 'is_interest')) {
    await db.execAsync('ALTER TABLE transactions DROP COLUMN is_interest;');
  }
}
