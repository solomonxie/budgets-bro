import type { SQLiteDatabase } from 'expo-sqlite';

// User-defined savings/payoff goals for the Baby Steps screen, alongside
// its fixed Dave Ramsey steps — a name, a target, and progress from either
// a linked account's live balance or a manually-entered amount (exactly
// one of the two is set; enforced in the repo, not the schema).
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE custom_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      target_cents INTEGER NOT NULL,
      linked_account_id INTEGER,
      manual_progress_cents INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_custom_goals_board ON custom_goals(board_id);
  `);
}
