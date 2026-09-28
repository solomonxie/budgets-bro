import type { SQLiteDatabase } from '../../src/db/driver';
import { rebuildChangeLogTriggers } from './030_change_log';

// ABR now detects recurring payments on its own (payee + exact amount), so a
// payee's review state no longer implies "ad hoc". `review_mode`: 'adHoc'
// (tracked by hand), 'dismissed' (not recurring / cancelled — never detected
// again), 'ignored' (still detected, listed under Ignored), NULL (detected,
// or not reviewed at all).
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE payees ADD COLUMN review_mode TEXT;
    UPDATE payees SET review_mode = 'adHoc' WHERE review_on IS NOT NULL;
  `);
  await rebuildChangeLogTriggers(db);
}
