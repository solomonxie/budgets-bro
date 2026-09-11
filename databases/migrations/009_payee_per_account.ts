import type { SQLiteDatabase } from 'expo-sqlite';

// Every account gets a payee, not just loan/mortgage ones (migration 008) —
// selecting another account's payee on a transaction is how inter-account
// transfers work (see payeesRepo.ensureAccountPayee /
// transactionsRepo.postLinkedAccountLeg). Backfill for accounts created
// before this became automatic (accountsRepo.createAccount is the normal
// trigger going forward).
export async function up(db: SQLiteDatabase): Promise<void> {
  const accounts = await db.getAllAsync<{ id: number; board_id: number; name: string }>(
    'SELECT id, board_id, name FROM accounts WHERE archived_at IS NULL',
  );
  for (const account of accounts) {
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
