import type { SQLiteDatabase } from '../../src/db/driver';
import { rebuildChangeLogTriggers } from './030_change_log';

// Annual payment review (Insights → ABR). A scheduled outflow is reviewed as
// monthly or annual; a payee with `review_on` set is an ad hoc commitment.
// NULL on a schedule means "never reviewed" — its first date is derived (see
// domain/paymentReview.ts); NULL on a payee means it isn't tracked at all.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE scheduled_transactions ADD COLUMN review_on TEXT;
    ALTER TABLE scheduled_transactions ADD COLUMN review_note TEXT;
    ALTER TABLE payees ADD COLUMN review_on TEXT;
    ALTER TABLE payees ADD COLUMN review_note TEXT;
    CREATE INDEX IF NOT EXISTS idx_payees_review ON payees(board_id) WHERE review_on IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_transactions_payee_date ON transactions(payee_id, date);
  `);
  await rebuildChangeLogTriggers(db);
}
