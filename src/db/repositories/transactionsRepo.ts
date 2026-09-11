import type { SQLiteDatabase } from 'expo-sqlite';
import type { TransactionJoinRow } from '../schema';
import type { TransactionWithLabels } from '../../domain/types';
import { currentDateISO } from '../../domain/month';
import { findOrCreatePayee } from './payeesRepo';
import { getCategory } from './categoriesRepo';
import { SELECT_WITH_LABELS, INSERT_TRANSACTION, UPDATE_TRANSACTION, LAST_CATEGORY_FOR_PAYEE } from '../../../databases/queries/transactions';

function mapRow(row: TransactionJoinRow): TransactionWithLabels {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    payeeId: row.payee_id,
    memo: row.memo,
    amountCents: row.amount_cents,
    date: row.date,
    cleared: row.cleared === 1,
    isInterest: row.is_interest === 1,
    transferAccountId: row.transfer_account_id,
    importId: row.import_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payeeName: row.payee_name,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
  };
}

export async function listTransactionsForAccount(
  db: SQLiteDatabase,
  boardId: number,
  accountId: number,
): Promise<TransactionWithLabels[]> {
  const rows = await db.getAllAsync<TransactionJoinRow>(
    `${SELECT_WITH_LABELS} WHERE t.account_id = ? AND t.board_id = ? ORDER BY t.date DESC, t.id DESC`,
    accountId,
    boardId,
  );
  return rows.map(mapRow);
}

export async function listTransactions(db: SQLiteDatabase, boardId: number): Promise<TransactionWithLabels[]> {
  const rows = await db.getAllAsync<TransactionJoinRow>(
    `${SELECT_WITH_LABELS} WHERE t.board_id = ? ORDER BY t.date DESC, t.id DESC`,
    boardId,
  );
  return rows.map(mapRow);
}

export async function getTransaction(db: SQLiteDatabase, id: number): Promise<TransactionWithLabels | null> {
  const row = await db.getFirstAsync<TransactionJoinRow>(`${SELECT_WITH_LABELS} WHERE t.id = ?`, id);
  return row ? mapRow(row) : null;
}

export async function getLastCategoryIdForPayee(db: SQLiteDatabase, payeeId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ category_id: number | null }>(LAST_CATEGORY_FOR_PAYEE, payeeId);
  return row?.category_id ?? null;
}

export interface CreateTransactionInput {
  accountId: number;
  categoryId: number | null;
  payeeName: string;
  memo: string | null;
  amountCents: number; // signed
  date: string;
  cleared: boolean;
  isInterest?: boolean;
}

// If `categoryId` is a loan/mortgage account's auto-generated payment
// category (see categoriesRepo.ensurePaymentCategory), also posts the
// mirrored credit to that loan account so its balance drops accordingly —
// the payment stays budgetable while the loan's balance stays accurate.
async function postLinkedAccountLeg(
  db: SQLiteDatabase,
  boardId: number,
  input: { categoryId: number | null; accountId: number; payeeId: number | null; memo: string | null; amountCents: number; date: string; cleared: boolean },
): Promise<void> {
  if (input.categoryId == null) return;
  const category = await getCategory(db, input.categoryId);
  if (!category?.linkedAccountId || category.linkedAccountId === input.accountId) return;
  await db.runAsync(
    INSERT_TRANSACTION,
    boardId,
    category.linkedAccountId,
    null,
    input.payeeId,
    input.memo,
    -input.amountCents,
    input.date,
    input.cleared ? 1 : 0,
    0,
    input.accountId,
    null,
  );
}

export async function createTransaction(db: SQLiteDatabase, boardId: number, input: CreateTransactionInput): Promise<number> {
  const payeeId = input.payeeName ? await findOrCreatePayee(db, boardId, input.payeeName) : null;
  let insertedId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      INSERT_TRANSACTION,
      boardId,
      input.accountId,
      input.categoryId,
      payeeId,
      input.memo,
      input.amountCents,
      input.date,
      input.cleared ? 1 : 0,
      input.isInterest ? 1 : 0,
      null,
      null,
    );
    insertedId = result.lastInsertRowId;
    await postLinkedAccountLeg(db, boardId, { ...input, payeeId });
  });
  return insertedId;
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: number;
}

// Scope cut: editing a transaction doesn't re-derive/rebalance a linked
// loan-account leg created at insert time — deleting and re-entering it
// keeps the loan balance correct if the category changes.
export async function updateTransaction(db: SQLiteDatabase, boardId: number, input: UpdateTransactionInput): Promise<void> {
  const payeeId = input.payeeName ? await findOrCreatePayee(db, boardId, input.payeeName) : null;
  await db.runAsync(
    UPDATE_TRANSACTION,
    input.accountId,
    input.categoryId,
    payeeId,
    input.memo,
    input.amountCents,
    input.date,
    input.cleared ? 1 : 0,
    input.isInterest ? 1 : 0,
    input.id,
  );
}

export async function deleteTransactions(db: SQLiteDatabase, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM transactions WHERE id IN (${placeholders})`, ...ids);
}

export interface CreateTransferInput {
  fromAccountId: number;
  toAccountId: number;
  amountCents: number; // positive
  date: string;
  memo: string | null;
}

export async function createTransfer(db: SQLiteDatabase, boardId: number, input: CreateTransferInput): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO transactions (board_id, account_id, amount_cents, date, memo, transfer_account_id) VALUES (?, ?, ?, ?, ?, ?)',
      boardId,
      input.fromAccountId,
      -Math.abs(input.amountCents),
      input.date,
      input.memo,
      input.toAccountId,
    );
    await db.runAsync(
      'INSERT INTO transactions (board_id, account_id, amount_cents, date, memo, transfer_account_id) VALUES (?, ?, ?, ?, ?, ?)',
      boardId,
      input.toAccountId,
      Math.abs(input.amountCents),
      input.date,
      input.memo,
      input.fromAccountId,
    );
  });
}

// Creates one uncategorized adjustment transaction for `deltaCents` — the
// "Correct Balance" action, not a separate reconciliation mechanism.
export async function correctBalance(db: SQLiteDatabase, boardId: number, accountId: number, deltaCents: number): Promise<void> {
  if (deltaCents === 0) return;
  const payeeId = await findOrCreatePayee(db, boardId, 'Balance Adjustment');
  await db.runAsync(
    'INSERT INTO transactions (board_id, account_id, payee_id, amount_cents, date, cleared) VALUES (?, ?, ?, ?, ?, 1)',
    boardId,
    accountId,
    payeeId,
    deltaCents,
    currentDateISO(),
  );
}

export interface ImportTransactionInput {
  accountId: number;
  categoryId: number | null;
  payeeId: number | null;
  memo: string | null;
  amountCents: number;
  date: string;
  cleared: boolean;
  isInterest: boolean;
  transferAccountId: number | null;
  importId: string;
}

// Upsert for the YNAB importer, keyed on the UNIQUE `import_id`: re-running
// the same export refreshes a row's fields instead of leaving it stale when
// the source data changed (e.g. a corrected amount or re-categorization).
// Known scope cut: `import_id` is unique globally, not per-board — importing
// the exact same YNAB export into two different boards would collide and
// update one board's row instead of creating a second copy in the other.
export async function importTransaction(db: SQLiteDatabase, boardId: number, input: ImportTransactionInput): Promise<'inserted' | 'updated'> {
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM transactions WHERE import_id = ?', input.importId);
  await db.runAsync(
    `INSERT INTO transactions (board_id, account_id, category_id, payee_id, memo, amount_cents, date, cleared, is_interest, transfer_account_id, import_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(import_id) DO UPDATE SET
       category_id = excluded.category_id,
       payee_id = excluded.payee_id,
       memo = excluded.memo,
       amount_cents = excluded.amount_cents,
       date = excluded.date,
       cleared = excluded.cleared,
       is_interest = excluded.is_interest,
       transfer_account_id = excluded.transfer_account_id,
       updated_at = datetime('now')`,
    boardId,
    input.accountId,
    input.categoryId,
    input.payeeId,
    input.memo,
    input.amountCents,
    input.date,
    input.cleared ? 1 : 0,
    input.isInterest ? 1 : 0,
    input.transferAccountId,
    input.importId,
  );
  return existing ? 'updated' : 'inserted';
}
