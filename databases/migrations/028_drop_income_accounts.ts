import type { SQLiteDatabase } from 'expo-sqlite';

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

// Income accounts are gone. They were a tag, not a place money sits
// (migration 021), and the tag was stamped onto every inflow automatically
// whether or not the user chose one — so a deposit read "Account: RRSP,
// Payee: Chequing, Income account: Income", three fields for one fact.
//
// An inflow's source is its payee. That is what a payee is for, it needs no
// second field, and income reporting groups by it instead (see
// reportsRepo.incomeByPayeeInRange).
//
// The tag columns go. The accounts themselves are converted to 'tracking' and
// archived rather than deleted: they hold no transactions of their own, but
// archiving keeps their names recoverable from Closed Accounts instead of
// vanishing. income_detail_history (pay-rate history) is left in place,
// unread — dropping a table the user typed into is not this migration's call.
export async function up(db: SQLiteDatabase): Promise<void> {
  if (await hasColumn(db, 'transactions', 'income_account_id')) {
    await db.execAsync('ALTER TABLE transactions DROP COLUMN income_account_id;');
  }
  if (await hasColumn(db, 'scheduled_transactions', 'income_account_id')) {
    await db.execAsync('ALTER TABLE scheduled_transactions DROP COLUMN income_account_id;');
  }
  await db.execAsync(`
    UPDATE accounts
    SET type = 'tracking', on_budget = 0, archived_at = COALESCE(archived_at, datetime('now'))
    WHERE type = 'income';
  `);
}
