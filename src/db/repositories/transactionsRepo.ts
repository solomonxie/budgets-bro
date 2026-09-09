import type { SQLiteDatabase } from 'expo-sqlite';
import type { TransactionJoinRow } from '../schema';
import type { TransactionWithLabels } from '../../domain/types';
import { currentDateISO } from '../../domain/month';
import { findOrCreatePayee } from './payeesRepo';

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

const SELECT_WITH_LABELS = `
  SELECT t.*, p.name as payee_name, c.name as category_name, c.icon as category_icon
  FROM transactions t
  LEFT JOIN payees p ON p.id = t.payee_id
  LEFT JOIN categories c ON c.id = t.category_id
`;

export async function listTransactionsForAccount(
  db: SQLiteDatabase,
  accountId: number,
): Promise<TransactionWithLabels[]> {
  const rows = await db.getAllAsync<TransactionJoinRow>(
    `${SELECT_WITH_LABELS} WHERE t.account_id = ? ORDER BY t.date DESC, t.id DESC`,
    accountId,
  );
  return rows.map(mapRow);
}

export async function listTransactions(db: SQLiteDatabase): Promise<TransactionWithLabels[]> {
  const rows = await db.getAllAsync<TransactionJoinRow>(`${SELECT_WITH_LABELS} ORDER BY t.date DESC, t.id DESC`);
  return rows.map(mapRow);
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

export async function createTransaction(db: SQLiteDatabase, input: CreateTransactionInput): Promise<number> {
  const payeeId = input.payeeName ? await findOrCreatePayee(db, input.payeeName) : null;
  const result = await db.runAsync(
    `INSERT INTO transactions (account_id, category_id, payee_id, memo, amount_cents, date, cleared, is_interest)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.accountId,
    input.categoryId,
    payeeId,
    input.memo,
    input.amountCents,
    input.date,
    input.cleared ? 1 : 0,
    input.isInterest ? 1 : 0,
  );
  return result.lastInsertRowId;
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

export async function createTransfer(db: SQLiteDatabase, input: CreateTransferInput): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO transactions (account_id, amount_cents, date, memo, transfer_account_id) VALUES (?, ?, ?, ?, ?)',
      input.fromAccountId,
      -Math.abs(input.amountCents),
      input.date,
      input.memo,
      input.toAccountId,
    );
    await db.runAsync(
      'INSERT INTO transactions (account_id, amount_cents, date, memo, transfer_account_id) VALUES (?, ?, ?, ?, ?)',
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
export async function correctBalance(db: SQLiteDatabase, accountId: number, deltaCents: number): Promise<void> {
  if (deltaCents === 0) return;
  const payeeId = await findOrCreatePayee(db, 'Balance Adjustment');
  await db.runAsync(
    'INSERT INTO transactions (account_id, payee_id, amount_cents, date, cleared) VALUES (?, ?, ?, ?, 1)',
    accountId,
    payeeId,
    deltaCents,
    currentDateISO(),
  );
}
