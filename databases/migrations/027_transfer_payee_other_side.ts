import type { SQLiteDatabase } from 'expo-sqlite';

// Settles what the two rows of a transfer are called: each names the account
// across from it. The payer's row names where the money went, the receiver's
// names where it came from.
//
// Migration 026 did that for cash-to-cash legs but left rows on loan and
// mortgage accounts labelled with their own account name — the old
// convention, which read as "Maple Street Mortgage" on the mortgage's own
// page and said nothing. This relabels any transfer leg still naming its own
// account, whatever its type.
//
// Only rows that are half of a transfer (transfer_account_id set) and only
// where the payee is the row's own account — a payee the user chose is left
// alone.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    UPDATE transactions
    SET payee_id = (SELECT p.id FROM payees p WHERE p.linked_account_id = transactions.transfer_account_id)
    WHERE transfer_account_id IS NOT NULL
      AND payee_id IN (SELECT p.id FROM payees p WHERE p.linked_account_id = transactions.account_id)
      AND EXISTS (SELECT 1 FROM payees p WHERE p.linked_account_id = transactions.transfer_account_id);
  `);
}
