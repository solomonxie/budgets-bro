import type { SQLiteDatabase } from '../../src/db/driver';

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

// What was actually bought, when the amount alone doesn't say: `Oil=8.40,
// Beef=12.99`. One string of `key=value` pairs rather than a child table or
// JSON — the list is short, it is only ever read whole, and keeping it in the
// row means every existing query, backup and restore carries it for free (see
// domain/purchaseItems.ts for the format).
export async function up(db: SQLiteDatabase): Promise<void> {
  if (!(await hasColumn(db, 'transactions', 'purchase_items'))) {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN purchase_items TEXT;');
  }
}
