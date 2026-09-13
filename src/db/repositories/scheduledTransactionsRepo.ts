import type { SQLiteDatabase } from 'expo-sqlite';
import type { ScheduledTransactionJoinRow } from '../schema';
import type { ScheduledTransactionWithLabels } from '../../domain/types';
import type { ScheduleFrequency } from '../../domain/recurrence';
import { findOrCreatePayee } from './payeesRepo';
import {
  LIST_FOR_BOARD,
  LIST_DUE_AUTO_POST,
  INSERT_SCHEDULED_TRANSACTION,
  UPDATE_SCHEDULED_TRANSACTION,
  UPDATE_NEXT_DATE,
  DELETE_SCHEDULED_TRANSACTION,
} from '../../../databases/queries/scheduledTransactions';

function mapRow(row: ScheduledTransactionJoinRow): ScheduledTransactionWithLabels {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    payeeId: row.payee_id,
    memo: row.memo,
    amountCents: row.amount_cents,
    frequency: row.frequency as ScheduleFrequency,
    intervalN: row.interval_n,
    nextDate: row.next_date,
    endDate: row.end_date,
    autoPost: row.auto_post === 1,
    createdAt: row.created_at,
    payeeName: row.payee_name,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    accountName: row.account_name,
  };
}

export async function listForBoard(db: SQLiteDatabase, boardId: number): Promise<ScheduledTransactionWithLabels[]> {
  const rows = await db.getAllAsync<ScheduledTransactionJoinRow>(LIST_FOR_BOARD, boardId);
  return rows.map(mapRow);
}

export async function listDueAutoPost(db: SQLiteDatabase, boardId: number, throughDate: string): Promise<ScheduledTransactionWithLabels[]> {
  const rows = await db.getAllAsync<ScheduledTransactionJoinRow>(LIST_DUE_AUTO_POST, boardId, throughDate);
  return rows.map(mapRow);
}

export interface ScheduledTransactionInput {
  accountId: number;
  categoryId: number | null;
  payeeName: string;
  memo: string | null;
  amountCents: number;
  frequency: ScheduleFrequency;
  intervalN: number;
  nextDate: string;
  endDate: string | null;
  autoPost: boolean;
}

export async function createScheduledTransaction(db: SQLiteDatabase, boardId: number, input: ScheduledTransactionInput): Promise<number> {
  const payeeId = input.payeeName ? await findOrCreatePayee(db, boardId, input.payeeName) : null;
  const result = await db.runAsync(
    INSERT_SCHEDULED_TRANSACTION,
    boardId,
    input.accountId,
    input.categoryId,
    payeeId,
    input.memo,
    input.amountCents,
    input.frequency,
    input.intervalN,
    input.nextDate,
    input.endDate,
    input.autoPost ? 1 : 0,
  );
  return result.lastInsertRowId;
}

export interface UpdateScheduledTransactionInput extends ScheduledTransactionInput {
  id: number;
}

export async function updateScheduledTransaction(db: SQLiteDatabase, boardId: number, input: UpdateScheduledTransactionInput): Promise<void> {
  const payeeId = input.payeeName ? await findOrCreatePayee(db, boardId, input.payeeName) : null;
  await db.runAsync(
    UPDATE_SCHEDULED_TRANSACTION,
    input.accountId,
    input.categoryId,
    payeeId,
    input.memo,
    input.amountCents,
    input.frequency,
    input.intervalN,
    input.nextDate,
    input.endDate,
    input.autoPost ? 1 : 0,
    input.id,
  );
}

export async function setNextDate(db: SQLiteDatabase, id: number, nextDate: string): Promise<void> {
  await db.runAsync(UPDATE_NEXT_DATE, nextDate, id);
}

export async function deleteScheduledTransaction(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(DELETE_SCHEDULED_TRANSACTION, id);
}
