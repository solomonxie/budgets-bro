import type { SQLiteDatabase } from '../../src/db/driver';
import { rebuildChangeLogTriggers } from './030_change_log';

// Sync sends one local transaction as one group (PROTOCOL.md "one tick per
// group"), so each change_log row needs to say which transaction wrote it.
// SQLite has no transaction id, so the driver bumps `sync_txn.id` at every
// BEGIN and the triggers copy it. `open` is 1 between BEGIN and COMMIT, which
// lets the outbox refuse to read half a transaction in one statement.
//
// The partial index finds a deleted row's gid from its delete entry, for an
// FK still pointing at it; deletes are a minority of the log.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_txn (id INTEGER NOT NULL, open INTEGER NOT NULL);
    INSERT INTO sync_txn (id, open) SELECT 0, 0 WHERE NOT EXISTS (SELECT 1 FROM sync_txn);
    ALTER TABLE change_log ADD COLUMN txn INTEGER;
    CREATE INDEX IF NOT EXISTS idx_change_log_deleted_row
      ON change_log(tbl, row_id) WHERE op = 'delete';
  `);
  await rebuildChangeLogTriggers(db);
}
