import type { SQLiteDatabase } from 'expo-sqlite';

async function hasTable(db: SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", name);
  return row != null;
}

// Same shape/rationale as migration 007's account_rate_history — a
// mortgage's home value changes over time (appraisals, market moves) and
// feeds Net Worth as the mortgage's offsetting asset, so it's a tracked
// history instead of the static `original_house_price_cents` column.
export async function up(db: SQLiteDatabase): Promise<void> {
  if (await hasTable(db, 'account_house_value_history')) return;

  await db.execAsync(`
    CREATE TABLE account_house_value_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      value_cents INTEGER NOT NULL,
      effective_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_account_house_value_history_account ON account_house_value_history(account_id);
  `);

  // Seed once from the existing original house price, only right after
  // creating the table — a re-run skips this (table already exists), so
  // existing accounts don't get a second duplicate seed row.
  await db.execAsync(`
    INSERT INTO account_house_value_history (account_id, value_cents, effective_date)
    SELECT id, original_house_price_cents, COALESCE(origination_date, date(created_at))
    FROM accounts
    WHERE type = 'mortgage' AND original_house_price_cents IS NOT NULL;
  `);
}
