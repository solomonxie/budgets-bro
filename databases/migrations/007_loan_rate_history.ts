import type { SQLiteDatabase } from 'expo-sqlite';

async function hasTable(db: SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", name);
  return row != null;
}

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

// Interest rate becomes a tracked history instead of one static column —
// a mortgage's rate isn't fixed for its life (renewals, refinances,
// variable-rate resets). `interest_rate_bps` stays on `accounts` (nothing
// reads it anymore, but dropping a column means a table rebuild for no
// real benefit); `account_rate_history`'s latest row is now the source of
// truth for "current rate". No `board_id` here — every row is reached via
// `account_id`, which is already board-scoped 1:1.
//
// Each step is existence-checked so this is safe to re-run from a partial
// failure — see migration 006's comment for why that matters.
export async function up(db: SQLiteDatabase): Promise<void> {
  const isNewTable = !(await hasTable(db, 'account_rate_history'));
  if (isNewTable) {
    await db.execAsync(`
      CREATE TABLE account_rate_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        rate_bps INTEGER NOT NULL,
        effective_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_account_rate_history_account ON account_rate_history(account_id);
    `);
    // Seed once, only right after creating the table — a re-run with the
    // table already present skips this, so existing accounts don't get a
    // second duplicate seed row.
    await db.execAsync(`
      INSERT INTO account_rate_history (account_id, rate_bps, effective_date)
      SELECT id, interest_rate_bps, COALESCE(origination_date, date(created_at))
      FROM accounts
      WHERE interest_rate_bps IS NOT NULL;
    `);
  }

  if (!(await hasColumn(db, 'accounts', 'original_house_price_cents'))) {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN original_house_price_cents INTEGER;');
  }
}
