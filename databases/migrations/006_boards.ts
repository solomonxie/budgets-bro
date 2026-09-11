import type { SQLiteDatabase } from 'expo-sqlite';

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

async function hasTable(db: SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", name);
  return row != null;
}

// Multi-tenancy: a "board" is a namespace holding its own accounts,
// categories, payees, and transactions — lets one install keep several
// separate budgets. Every board-owned table gets a board_id column
// (defaulting to the bootstrap board so existing data doesn't move) instead
// of splitting into separate SQLite files, so all the existing single-DB
// plumbing (getDb, migrate) keeps working unchanged.
//
// Every step below is written to be safe to re-run: `execAsync` isn't
// transactional, so if any one step throws, everything before it in a
// previous attempt is already committed — the next app launch re-enters
// this migration (user_version wasn't bumped) and would otherwise crash
// on "table/column already exists" instead of finishing the job.
export async function up(db: SQLiteDatabase): Promise<void> {
  if (!(await hasTable(db, 'boards'))) {
    await db.execAsync(`
      CREATE TABLE boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
  await db.execAsync("INSERT OR IGNORE INTO boards (id, name) VALUES (1, 'My Budget');");

  // No REFERENCES clause here — SQLite's ALTER TABLE ADD COLUMN refuses a
  // column that combines a REFERENCES clause with a non-NULL DEFAULT
  // ("Cannot add a REFERENCES column with non-NULL default value"). The FK
  // is enforced at the application level instead (boardsRepo.deleteBoard
  // already cascades deletes across these tables manually).
  const boardScopedTables = ['accounts', 'category_groups', 'categories', 'budget_entries', 'transactions'];
  for (const table of boardScopedTables) {
    if (!(await hasColumn(db, table, 'board_id'))) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN board_id INTEGER NOT NULL DEFAULT 1;`);
    }
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_${table}_board ON ${table}(board_id);`);
  }

  // payees.name was globally UNIQUE; two boards need to each be able to have
  // their own "Amazon" — rebuild with a per-board unique constraint instead
  // (SQLite can't ALTER a UNIQUE constraint in place). Foreign keys are
  // dropped around the rebuild — transactions.payee_id would otherwise
  // block DROP TABLE payees while it still has referencing rows. Toggling
  // the pragma has to happen outside any transaction, so this stays as
  // separate execAsync calls rather than one BEGIN/COMMIT block.
  if (!(await hasColumn(db, 'payees', 'board_id'))) {
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    if (await hasTable(db, 'payees_new')) {
      await db.execAsync('DROP TABLE payees_new;');
    }
    await db.execAsync(`
      CREATE TABLE payees_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL REFERENCES boards(id) DEFAULT 1,
        name TEXT NOT NULL,
        UNIQUE(board_id, name)
      );
      INSERT INTO payees_new (id, board_id, name) SELECT id, 1, name FROM payees;
      DROP TABLE payees;
      ALTER TABLE payees_new RENAME TO payees;
      CREATE INDEX IF NOT EXISTS idx_payees_board ON payees(board_id);
    `);
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}
