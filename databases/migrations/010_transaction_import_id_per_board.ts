import type { SQLiteDatabase } from 'expo-sqlite';

async function hasTable(db: SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", name);
  return row != null;
}

// import_id was globally UNIQUE (migration 001) instead of scoped per board.
// Importing the same YNAB export (same account/date/payee content) into a
// second board collided with the first board's rows: transactionsRepo
// .importTransaction's ON CONFLICT never touches board_id/account_id, so it
// silently updated the OTHER board's transaction instead of creating this
// board's copy — the import looked like it inserted/updated nothing.
// Rescope to UNIQUE(board_id, import_id) so identical content imports
// cleanly into every board independently. Safe rebuild: import_id was
// already globally unique, so no existing row can violate the narrower
// per-board constraint.
export async function up(db: SQLiteDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'transactions'",
  );
  if (table?.sql.includes('UNIQUE(board_id, import_id)')) return;

  await db.execAsync('PRAGMA foreign_keys = OFF;');
  if (await hasTable(db, 'transactions_new')) {
    await db.execAsync('DROP TABLE transactions_new;');
  }
  await db.execAsync(`
    CREATE TABLE transactions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL REFERENCES boards(id) DEFAULT 1,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      category_id INTEGER REFERENCES categories(id),
      payee_id INTEGER REFERENCES payees(id),
      memo TEXT,
      amount_cents INTEGER NOT NULL,
      date TEXT NOT NULL,
      cleared INTEGER NOT NULL DEFAULT 0,
      is_interest INTEGER NOT NULL DEFAULT 0,
      transfer_account_id INTEGER REFERENCES accounts(id),
      import_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(board_id, import_id)
    );
    INSERT INTO transactions_new (id, board_id, account_id, category_id, payee_id, memo, amount_cents, date, cleared, is_interest, transfer_account_id, import_id, created_at, updated_at)
      SELECT id, board_id, account_id, category_id, payee_id, memo, amount_cents, date, cleared, is_interest, transfer_account_id, import_id, created_at, updated_at FROM transactions;
    DROP TABLE transactions;
    ALTER TABLE transactions_new RENAME TO transactions;
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_board ON transactions(board_id);
  `);
  await db.execAsync('PRAGMA foreign_keys = ON;');
}
