import type { SQLiteDatabase } from 'expo-sqlite';

// Full Phase 1/2 schema, created up front so it's versioned from commit one
// even though CRUD for these tables lands across later phases.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      on_budget INTEGER NOT NULL DEFAULT 1,
      currency TEXT NOT NULL DEFAULT 'USD',
      opening_balance_cents INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE category_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES category_groups(id),
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT
    );

    CREATE TABLE budget_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      month TEXT NOT NULL,
      assigned_cents INTEGER NOT NULL DEFAULT 0,
      UNIQUE(category_id, month)
    );

    CREATE TABLE payees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      category_id INTEGER REFERENCES categories(id),
      payee_id INTEGER REFERENCES payees(id),
      memo TEXT,
      amount_cents INTEGER NOT NULL,
      date TEXT NOT NULL,
      cleared INTEGER NOT NULL DEFAULT 0,
      transfer_account_id INTEGER REFERENCES accounts(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_transactions_account ON transactions(account_id);
    CREATE INDEX idx_transactions_category ON transactions(category_id);
    CREATE INDEX idx_budget_entries_month ON budget_entries(month);
  `);
}
