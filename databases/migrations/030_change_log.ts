import type { SQLiteDatabase } from '../../src/db/driver';

// Tables whose rows are the user's own data. Deliberately not settings, AI
// request history or the log itself — nobody wants to undo a preference, and
// logging the log recurses.
const LOGGED_TABLES = [
  'accounts',
  'categories',
  'category_groups',
  'budget_entries',
  'payees',
  'transactions',
  'account_value_history',
  'account_rate_history',
  'scheduled_transactions',
  'custom_goals',
];

async function columnsOf(db: SQLiteDatabase, table: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name);
}

// An append-only record of every row that changes, written by the database
// itself rather than by the code that does the changing.
//
// That distinction is the whole point. App-level logging is bypassed by
// anything that doesn't go through the repo layer — a migration, a repair, a
// hand-written UPDATE — which is exactly the category of change most worth
// having a record of. Migration 029 cleared a column with no way back;
// triggers would have caught it, because they fire for migrations too.
//
// Each entry keeps the row before and after as JSON, so a single change can
// be reversed on its own: an insert by deleting, an update by putting the old
// values back, a delete by writing the row again.
//
// The column list is read at trigger-creation time, so a column added by a
// later migration won't appear in entries written by these triggers. That
// migration should rebuild them (see rebuildChangeLogTriggers), which is
// cheap — they are derived, and dropping them loses nothing already written.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS change_log (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL DEFAULT (datetime('now')),
      tbl TEXT NOT NULL,
      op TEXT NOT NULL,
      row_id INTEGER,
      before TEXT,
      after TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_change_log_at ON change_log(at);
  `);
  await rebuildChangeLogTriggers(db);
}

export async function rebuildChangeLogTriggers(db: SQLiteDatabase): Promise<void> {
  for (const table of LOGGED_TABLES) {
    const columns = await columnsOf(db, table);
    if (columns.length === 0) continue; // table not in this database
    const json = (alias: string) => `json_object(${columns.map((c) => `'${c}', ${alias}.${c}`).join(', ')})`;

    await db.execAsync(`
      DROP TRIGGER IF EXISTS trg_${table}_log_insert;
      DROP TRIGGER IF EXISTS trg_${table}_log_update;
      DROP TRIGGER IF EXISTS trg_${table}_log_delete;

      CREATE TRIGGER trg_${table}_log_insert AFTER INSERT ON ${table} BEGIN
        INSERT INTO change_log (tbl, op, row_id, before, after)
        VALUES ('${table}', 'insert', new.rowid, NULL, ${json('new')});
      END;

      CREATE TRIGGER trg_${table}_log_update AFTER UPDATE ON ${table} BEGIN
        INSERT INTO change_log (tbl, op, row_id, before, after)
        VALUES ('${table}', 'update', old.rowid, ${json('old')}, ${json('new')});
      END;

      CREATE TRIGGER trg_${table}_log_delete AFTER DELETE ON ${table} BEGIN
        INSERT INTO change_log (tbl, op, row_id, before, after)
        VALUES ('${table}', 'delete', old.rowid, ${json('old')}, NULL);
      END;
    `);
  }
}
