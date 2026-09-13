import type { SQLiteDatabase } from 'expo-sqlite';
import type { ScheduledTransactionJoinRow } from '../schema';
import type { ScheduledTransactionWithLabels } from '../../domain/types';
import type { ScheduleFrequency } from '../../domain/recurrence';
import { nextOccurrenceDate } from '../../domain/recurrence';
import { currentDateISO } from '../../domain/month';
import { findOrCreatePayee } from './payeesRepo';
import * as transactionsRepo from './transactionsRepo';
import {
  LIST_FOR_BOARD,
  LIST_DUE,
  GET_BY_ID,
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
    daysOfWeekMask: row.days_of_week_mask,
    nextDate: row.next_date,
    endDate: row.end_date,
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

export async function getScheduledTransaction(db: SQLiteDatabase, id: number): Promise<ScheduledTransactionWithLabels | null> {
  const row = await db.getFirstAsync<ScheduledTransactionJoinRow>(GET_BY_ID, id);
  return row ? mapRow(row) : null;
}

// Schedules waiting on approval — `next_date <= today`. Nothing here has
// posted to `transactions` yet; see approveOccurrence.
export async function listDue(db: SQLiteDatabase, boardId: number, throughDate: string): Promise<ScheduledTransactionWithLabels[]> {
  const rows = await db.getAllAsync<ScheduledTransactionJoinRow>(LIST_DUE, boardId, throughDate);
  return rows.map(mapRow);
}

// Caps how many missed occurrences a single approval catches up on — a
// safety valve against an old/stale `next_date` (e.g. a weekly schedule
// left pending for years) looping effectively forever.
const MAX_CATCHUP_OCCURRENCES = 366;

// Posts every occurrence of schedule `id` from its next_date through today
// (catching up on any missed while unapproved), advances next_date past
// today, and deletes the schedule once it's run past its end date. This is
// the only place a scheduled transaction ever turns into a real row in
// `transactions` — see usePendingScheduledTransactions for the UI that
// calls it (Budget board's Spent This Month box).
export async function approveOccurrence(db: SQLiteDatabase, boardId: number, id: number): Promise<void> {
  const s = await getScheduledTransaction(db, id);
  if (!s) return;
  const today = currentDateISO();
  let nextDate = s.nextDate;
  let posted = false;
  for (let i = 0; i < MAX_CATCHUP_OCCURRENCES && nextDate <= today; i++) {
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: s.accountId,
      categoryId: s.categoryId,
      payeeName: s.payeeName ?? '',
      memo: s.memo,
      amountCents: s.amountCents,
      date: nextDate,
    });
    posted = true;
    nextDate = nextOccurrenceDate(nextDate, s.frequency, s.intervalN, s.daysOfWeekMask, s.createdAt.slice(0, 10));
    if (s.endDate != null && nextDate > s.endDate) break;
  }
  if (!posted) return;
  if (s.endDate != null && nextDate > s.endDate) await deleteScheduledTransaction(db, s.id);
  else await setNextDate(db, s.id, nextDate);
}

export interface ScheduledTransactionInput {
  accountId: number;
  categoryId: number | null;
  payeeName: string;
  memo: string | null;
  amountCents: number;
  frequency: ScheduleFrequency;
  intervalN: number;
  daysOfWeekMask: number | null;
  nextDate: string;
  endDate: string | null;
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
    input.daysOfWeekMask,
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
    input.daysOfWeekMask,
    input.id,
  );
}

export async function setNextDate(db: SQLiteDatabase, id: number, nextDate: string): Promise<void> {
  await db.runAsync(UPDATE_NEXT_DATE, nextDate, id);
}

export async function deleteScheduledTransaction(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(DELETE_SCHEDULED_TRANSACTION, id);
}
