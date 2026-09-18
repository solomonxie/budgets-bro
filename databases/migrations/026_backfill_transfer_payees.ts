import type { SQLiteDatabase } from 'expo-sqlite';

// Transfers used to post both legs with no payee at all (transactionsRepo's
// createTransfer), so a mortgage paid by transfer left a row on the loan
// account reading "(No payee)" — while the same transaction opened from the
// detail page looked right, because that page shows the account's own payee
// for loan rows.
//
// Two backfills, matching how each kind of row is read:
//   - a row on a loan/mortgage account takes that account's own payee, the
//     convention a mirrored payment leg already follows (see
//     postLinkedAccountLeg) and the one the detail page locks to;
//   - any other transfer leg takes the payee of the account on the other
//     side, so it reads as where the money went.
//
// Only touches rows that have no payee — nothing the user named is
// overwritten.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    UPDATE transactions
    SET payee_id = (SELECT p.id FROM payees p WHERE p.linked_account_id = transactions.account_id)
    WHERE payee_id IS NULL
      AND account_id IN (SELECT id FROM accounts WHERE type IN ('loan', 'mortgage'))
      AND EXISTS (SELECT 1 FROM payees p WHERE p.linked_account_id = transactions.account_id);
  `);
  await db.execAsync(`
    UPDATE transactions
    SET payee_id = (SELECT p.id FROM payees p WHERE p.linked_account_id = transactions.transfer_account_id)
    WHERE payee_id IS NULL
      AND transfer_account_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM payees p WHERE p.linked_account_id = transactions.transfer_account_id);
  `);
}
