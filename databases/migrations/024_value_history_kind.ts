import type { SQLiteDatabase } from 'expo-sqlite';

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

// account_value_history now holds two kinds of reading, not one:
//   'value'     — what the thing is worth (a home's value, a tracking
//                 account's total). Every existing row.
//   'principal' — what is still owed on a loan, as the lender states it.
//
// Same shape, same "latest effective_date wins" rule, so a loan's remaining
// principal is a logged reading like any other rather than a balance summed
// from transactions. Between readings it is estimated by splitting each real
// payment into interest and principal (finance-tools/remainingPrincipal) —
// payments stay exactly as the bank statement shows them, one transaction
// each, and correcting the principal never invents an adjustment transaction.
export async function up(db: SQLiteDatabase): Promise<void> {
  if (await hasColumn(db, 'account_value_history', 'kind')) return;
  await db.execAsync("ALTER TABLE account_value_history ADD COLUMN kind TEXT NOT NULL DEFAULT 'value';");
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_account_value_history_account_kind ON account_value_history(account_id, kind);');
}
