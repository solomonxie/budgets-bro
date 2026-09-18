import type { SQLiteDatabase } from '../../src/db/driver';

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

// Every schedule used to post itself silently the moment it came due
// (`auto_post`, hardcoded true on creation — see AddTransactionModal).
// Replaced with a manual-approval queue (Budget board's Spent This Month
// box surfaces due items; nothing lands in `transactions` until the user
// taps Approve — see scheduledTransactionsRepo.approveOccurrence and
// usePendingScheduledTransactions), so the flag no longer means anything:
// every row behaves the same way now.
export async function up(db: SQLiteDatabase): Promise<void> {
  if (await hasColumn(db, 'scheduled_transactions', 'auto_post')) {
    await db.execAsync('ALTER TABLE scheduled_transactions DROP COLUMN auto_post;');
  }
}
