import type { SQLiteDatabase } from '../../src/db/driver';
import { rebuildChangeLogTriggers } from './030_change_log';

// The user's own order within each group on the Accounts page. Every
// existing row starts at 0, so until something is dragged the name breaks
// the tie and nothing moves.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('ALTER TABLE accounts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;');
  await rebuildChangeLogTriggers(db);
}
