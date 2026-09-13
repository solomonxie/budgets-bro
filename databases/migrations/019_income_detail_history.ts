import type { SQLiteDatabase } from 'expo-sqlite';

// Effective-dated income details for an 'income' account — pay rate
// changes, a per-hour rate alongside variable logged hours, etc. Same
// shape as account_rate_history, generalized with a unit instead of
// assuming an annual percentage rate.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE income_detail_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      unit TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_income_detail_history_account ON income_detail_history(account_id);
  `);
}
