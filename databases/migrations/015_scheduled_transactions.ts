import type { SQLiteDatabase } from 'expo-sqlite';

async function hasTable(db: SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", name);
  return row != null;
}

// Recurring-transaction templates (T8.7) — mirrors a real transaction's
// shape (account/category/payee/memo/amount) plus scheduling fields.
// Posting a schedule creates a normal row in `transactions`; this table
// itself never appears in any balance/activity query. No `is_interest`
// column — that concept was removed entirely from `transactions` in
// migration 013 and shouldn't be reintroduced here.
export async function up(db: SQLiteDatabase): Promise<void> {
  if (await hasTable(db, 'scheduled_transactions')) return;

  await db.execAsync(`
    CREATE TABLE scheduled_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      category_id INTEGER,
      payee_id INTEGER,
      memo TEXT,
      amount_cents INTEGER NOT NULL,
      frequency TEXT NOT NULL,
      interval_n INTEGER NOT NULL DEFAULT 1,
      next_date TEXT NOT NULL,
      end_date TEXT,
      auto_post INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_scheduled_transactions_board ON scheduled_transactions(board_id);
  `);
}
