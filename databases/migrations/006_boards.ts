import type { SQLiteDatabase } from 'expo-sqlite';

// Multi-tenancy: a "board" is a namespace holding its own accounts,
// categories, payees, and transactions — lets one install keep several
// separate budgets. Every board-owned table gets a board_id column
// (defaulting to the bootstrap board so existing data doesn't move) instead
// of splitting into separate SQLite files, so all the existing single-DB
// plumbing (getDb, migrate) keeps working unchanged.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO boards (id, name) VALUES (1, 'My Budget');

    ALTER TABLE accounts ADD COLUMN board_id INTEGER NOT NULL REFERENCES boards(id) DEFAULT 1;
    ALTER TABLE category_groups ADD COLUMN board_id INTEGER NOT NULL REFERENCES boards(id) DEFAULT 1;
    ALTER TABLE categories ADD COLUMN board_id INTEGER NOT NULL REFERENCES boards(id) DEFAULT 1;
    ALTER TABLE budget_entries ADD COLUMN board_id INTEGER NOT NULL REFERENCES boards(id) DEFAULT 1;
    ALTER TABLE transactions ADD COLUMN board_id INTEGER NOT NULL REFERENCES boards(id) DEFAULT 1;

    CREATE INDEX idx_accounts_board ON accounts(board_id);
    CREATE INDEX idx_category_groups_board ON category_groups(board_id);
    CREATE INDEX idx_categories_board ON categories(board_id);
    CREATE INDEX idx_budget_entries_board ON budget_entries(board_id);
    CREATE INDEX idx_transactions_board ON transactions(board_id);

    -- payees.name was globally UNIQUE; two boards need to each be able to
    -- have their own "Amazon" — rebuild with a per-board unique constraint
    -- instead (SQLite can't ALTER a UNIQUE constraint in place). Foreign
    -- keys are dropped around the rebuild — transactions.payee_id would
    -- otherwise block DROP TABLE payees while it still has referencing rows.
    PRAGMA foreign_keys = OFF;
    CREATE TABLE payees_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL REFERENCES boards(id) DEFAULT 1,
      name TEXT NOT NULL,
      UNIQUE(board_id, name)
    );
    INSERT INTO payees_new (id, board_id, name) SELECT id, 1, name FROM payees;
    DROP TABLE payees;
    ALTER TABLE payees_new RENAME TO payees;
    CREATE INDEX idx_payees_board ON payees(board_id);
    PRAGMA foreign_keys = ON;
  `);
}
