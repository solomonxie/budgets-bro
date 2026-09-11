import type { SQLiteDatabase } from 'expo-sqlite';

async function hasColumn(db: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

// Debt-account linkage moves from category to payee: pick "Dachang House
// debt" (or whatever the account is named) as a transaction's payee and it
// posts to that account too, regardless of category — see
// payeesRepo.ensurePaymentPayee / transactionsRepo.postLinkedAccountLeg.
// `categories.linked_account_id` (migration 002) is left in place but no
// longer read or written by the app — not worth a table rebuild to drop it.
export async function up(db: SQLiteDatabase): Promise<void> {
  const isNewColumn = !(await hasColumn(db, 'payees', 'linked_account_id'));
  if (isNewColumn) {
    await db.execAsync(`
      ALTER TABLE payees ADD COLUMN linked_account_id INTEGER;
      CREATE INDEX idx_payees_linked_account ON payees(linked_account_id);
    `);
  }

  // Backfill: every existing loan/mortgage account gets its payment payee
  // now, named after it, instead of waiting for the account to next be
  // edited (accountsRepo.updateAccount is the normal trigger).
  const loanAccounts = await db.getAllAsync<{ id: number; board_id: number; name: string }>(
    "SELECT id, board_id, name FROM accounts WHERE type IN ('loan', 'mortgage') AND archived_at IS NULL",
  );
  for (const account of loanAccounts) {
    const linked = await db.getFirstAsync<{ id: number }>('SELECT id FROM payees WHERE linked_account_id = ?', account.id);
    if (linked) continue;
    const sameName = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM payees WHERE name = ? AND board_id = ?',
      account.name,
      account.board_id,
    );
    if (sameName) {
      await db.runAsync('UPDATE payees SET linked_account_id = ? WHERE id = ?', account.id, sameName.id);
    } else {
      await db.runAsync('INSERT INTO payees (board_id, name, linked_account_id) VALUES (?, ?, ?)', account.board_id, account.name, account.id);
    }
  }
}
