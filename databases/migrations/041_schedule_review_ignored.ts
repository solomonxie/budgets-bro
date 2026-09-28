import type { SQLiteDatabase } from '../../src/db/driver';
import { rebuildChangeLogTriggers } from './030_change_log';

// ABR's "Ignore": a real recurring payment the user doesn't want reviewed
// (rent, say). Listed under Ignored, never due. Payees use
// review_mode = 'ignored' instead.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('ALTER TABLE scheduled_transactions ADD COLUMN review_ignored INTEGER NOT NULL DEFAULT 0;');
  await rebuildChangeLogTriggers(db);
}
