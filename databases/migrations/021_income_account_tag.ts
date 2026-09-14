import type { SQLiteDatabase } from 'expo-sqlite';

// Income accounts become a tag, not a ledger: a transaction lives on the
// real account the money landed in (cash/savings/tracking/...) and
// optionally points `income_account_id` at an Income-typed account to mark
// it as that stream's earnings — replacing the old create-then-sweep pair
// (a real entry on the Income account + a mirrored transfer into a
// board-wide default cash account) that was two independently-editable
// rows and could desync on edit/delete.
//
// Existing income-account entries (pre-sweep, transfer_account_id IS NULL)
// are backfilled with income_account_id = their own account id so
// historical income-insights totals keep working; the old sweep-transfer
// pairs are left in place (self-cancelling, harmless) rather than
// surgically collapsed — Income accounts are excluded from Net Worth by
// kind regardless (see domain/accountKind.ts), so a frozen ~0 ledger
// balance on them going forward is never shown or summed anywhere.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('ALTER TABLE transactions ADD COLUMN income_account_id INTEGER REFERENCES accounts(id);');
  await db.execAsync(`
    UPDATE transactions SET income_account_id = account_id
    WHERE transfer_account_id IS NULL
      AND account_id IN (SELECT id FROM accounts WHERE type = 'income')
  `);
  // Recurring income schedules carry the same tag, so an auto-posted
  // occurrence keeps it (see scheduledTransactionsRepo.approveOccurrence).
  await db.execAsync('ALTER TABLE scheduled_transactions ADD COLUMN income_account_id INTEGER REFERENCES accounts(id);');
}
