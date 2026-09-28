import type { SQLiteDatabase } from '../../src/db/driver';
import { rebuildChangeLogTriggers } from './030_change_log';

// ABR decisions. A decision never touches transactions or schedules: one
// that needs doing (cancel, convert, switch, find an alternative) becomes a
// reminder until the user marks it done (`done_on`); the rest are logged
// done on the spot. Together they are the To Do list and the History.
// `name`/`cadence`/`amount_cents` are a snapshot, so history still reads
// right after the schedule or payee is gone. No FKs, like the other
// board-scoped tables (see migration 006).
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS payment_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      scheduled_transaction_id INTEGER,
      payee_id INTEGER,
      name TEXT NOT NULL,
      cadence TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      decision TEXT NOT NULL,
      note TEXT,
      decided_on TEXT NOT NULL,
      due_on TEXT,
      done_on TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_payment_decisions_board ON payment_decisions(board_id, done_on);
  `);
  await rebuildChangeLogTriggers(db);
}
