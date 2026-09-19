import type { SQLiteDatabase } from '../../db/driver';
import { INSERT_TRANSACTION } from '../../../databases/queries/transactions';
import {
  auditTransfers,
  counterpartAccountId,
  isSafeToAutoFix,
  matchPairs,
  summarize,
} from '../../domain/transferIntegrity';
import type {
  AuditSummary,
  TransferRow,
  TransferViolation,
} from '../../domain/transferIntegrity';

interface Row {
  id: number;
  account_id: number;
  transfer_account_id: number | null;
  payee_id: number | null;
  payee_linked_account_id: number | null;
  amount_cents: number;
  date: string;
}

// Every row that could be half of a transfer — marked as one, or carrying a
// payee named after an account. A plain spend is left out: it can't be half
// of anything, and the audit walks this list several times.
export async function listTransferRows(db: SQLiteDatabase, boardId: number): Promise<TransferRow[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT t.id, t.account_id, t.transfer_account_id, t.payee_id,
            p.linked_account_id as payee_linked_account_id,
            t.amount_cents, t.date
     FROM transactions t
     LEFT JOIN payees p ON p.id = t.payee_id
     WHERE t.board_id = ?
       AND (t.transfer_account_id IS NOT NULL OR p.linked_account_id IS NOT NULL)
     ORDER BY t.date, t.id`,
    boardId,
  );
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    transferAccountId: row.transfer_account_id,
    payeeId: row.payee_id,
    payeeLinkedAccountId: row.payee_linked_account_id,
    amountCents: row.amount_cents,
    date: row.date,
  }));
}

export async function auditBoardTransfers(db: SQLiteDatabase, boardId: number): Promise<TransferViolation[]> {
  return auditTransfers(await listTransferRows(db, boardId));
}

async function payeeIdForAccount(db: SQLiteDatabase, accountId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM payees WHERE linked_account_id = ?', accountId);
  return row?.id ?? null;
}

export interface RepairResult {
  found: AuditSummary;
  fixed: AuditSummary;
}

// Applies every repair that only changes what a row is *called* or what it
// points at — naming an unnamed leg after the account across from it,
// re-pointing one that named itself, and marking a leg whose partner was
// already marked. Never posts or deletes a transaction, so no balance moves
// and the result needs no confirmation.
//
// `missingLeg` and `amountMismatch` are counted and left alone: one would
// invent money and the other can't be settled without knowing which side is
// right. Both are reported back for the user to decide on.
export async function repairSafeViolations(db: SQLiteDatabase, boardId: number): Promise<RepairResult> {
  const violations = await auditBoardTransfers(db, boardId);
  const fixed: AuditSummary = {
    missingLeg: 0,
    amountMismatch: 0,
    unmarked: 0,
    selfNamed: 0,
    unnamedLeg: 0,
  };

  await db.withTransactionAsync(async () => {
    for (const violation of violations) {
      if (!isSafeToAutoFix(violation)) continue;
      if (violation.kind === 'unmarked') {
        await db.runAsync(
          'UPDATE transactions SET transfer_account_id = ? WHERE id = ?',
          violation.counterpartAccountId,
          violation.row.id,
        );
        fixed.unmarked += 1;
        continue;
      }
      // Both remaining kinds want the same thing: the row named after the
      // account on the other side of it.
      const counterpart =
        violation.kind === 'unnamedLeg'
          ? violation.counterpartAccountId
          : violation.row.transferAccountId;
      if (counterpart == null) continue;
      const payeeId = await payeeIdForAccount(db, counterpart);
      if (payeeId == null) continue;
      await db.runAsync('UPDATE transactions SET payee_id = ? WHERE id = ?', payeeId, violation.row.id);
      if (violation.kind === 'unnamedLeg') fixed.unnamedLeg += 1;
      else fixed.selfNamed += 1;
    }
  });

  return { found: summarize(violations), fixed };
}

// One row's worth of repair, for the review page's Fix button. Each problem
// has its own correct answer, so this dispatches on the reason rather than
// offering one generic "fix":
//
//   transferUnnamed / transferSelfNamed  name it after the account opposite
//   transferUnlinked                     mark both halves as a pair
//   transferMissingLeg                   post the half that was never written
//   transferAmountMismatch               make the partner cancel this row
//
// The row in hand is the authority for the amount: it is the one the user is
// looking at, and guessing which of two disagreeing numbers is right is not
// something a button should do silently.
export async function quickFixTransfer(
  db: SQLiteDatabase,
  boardId: number,
  txnId: number,
  reason: 'transferUnnamed' | 'transferSelfNamed' | 'transferUnlinked' | 'transferMissingLeg' | 'transferAmountMismatch',
): Promise<boolean> {
  const rows = await listTransferRows(db, boardId);
  const row = rows.find((r) => r.id === txnId);
  if (!row) return false;
  const counterpart = counterpartAccountId(row);
  if (counterpart == null) return false;

  if (reason === 'transferUnnamed' || reason === 'transferSelfNamed') {
    const payeeId = await payeeIdForAccount(db, counterpart);
    if (payeeId == null) return false;
    await db.runAsync('UPDATE transactions SET payee_id = ? WHERE id = ?', payeeId, row.id);
    return true;
  }

  if (reason === 'transferUnlinked') {
    await db.runAsync('UPDATE transactions SET transfer_account_id = ? WHERE id = ?', counterpart, row.id);
    return true;
  }

  const { pairs } = matchPairs(rows);
  const pair = pairs.find((p) => p.a.id === row.id || p.b.id === row.id);

  if (reason === 'transferAmountMismatch') {
    if (!pair) return false;
    const partner = pair.a.id === row.id ? pair.b : pair.a;
    await db.runAsync(
      `UPDATE transactions SET amount_cents = ?, date = ?, updated_at = datetime('now') WHERE id = ?`,
      -row.amountCents,
      row.date,
      partner.id,
    );
    return true;
  }

  // transferMissingLeg — the only quick fix that posts a transaction. It
  // writes the mirror this row always implied: the opposite amount, in the
  // account it names, naming this row's account back.
  if (pair) return false;
  await db.runAsync(
    INSERT_TRANSACTION,
    boardId,
    counterpart,
    null,
    await payeeIdForAccount(db, row.accountId),
    null,
    -row.amountCents,
    row.date,
    row.accountId,
    null,
  );
  await db.runAsync('UPDATE transactions SET transfer_account_id = ? WHERE id = ?', counterpart, row.id);
  return true;
}
