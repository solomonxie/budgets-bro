import type { SQLiteDatabase } from 'expo-sqlite';

async function hasTable(db: SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", name);
  return row != null;
}

// `account_house_value_history` (migration 011) was already schema-generic
// (account_id, value_cents, effective_date) — only its name was
// mortgage-specific. Renamed so it can also hold a tracking/investment
// account's manually-logged value history (see T8.6 in
// docs/IMPLEMENTATION_PLAN.md), rather than adding a second near-identical
// table for the same shape.
export async function up(db: SQLiteDatabase): Promise<void> {
  if (!(await hasTable(db, 'account_house_value_history'))) return;
  await db.execAsync(`
    ALTER TABLE account_house_value_history RENAME TO account_value_history;
    DROP INDEX IF EXISTS idx_account_house_value_history_account;
    CREATE INDEX idx_account_value_history_account ON account_value_history(account_id);
  `);
}
