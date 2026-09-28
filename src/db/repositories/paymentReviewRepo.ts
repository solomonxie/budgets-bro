import type { SQLiteDatabase } from '../driver';
import type { AdHocPayee, ReviewItem } from '../../domain/paymentReview';
import type { ScheduleFrequency } from '../../domain/recurrence';
import { findOrCreatePayee } from './payeesRepo';
import * as scheduledTransactionsRepo from './scheduledTransactionsRepo';
import * as transactionsRepo from './transactionsRepo';
import {
  LIST_AD_HOC,
  LAST_OUTFLOW_FOR_PAYEE,
  SET_SCHEDULE_REVIEW,
  SET_PAYEE_REVIEW,
  CONVERT_SCHEDULE,
} from '../../../databases/queries/paymentReview';

interface AdHocRow {
  payee_id: number;
  name: string;
  review_on: string;
  review_note: string | null;
  last_date: string | null;
  last_amount_cents: number | null;
  year_cents: number;
}

export async function listAdHoc(db: SQLiteDatabase, boardId: number, yearStart: string): Promise<AdHocPayee[]> {
  const rows = await db.getAllAsync<AdHocRow>(LIST_AD_HOC, yearStart, boardId);
  return rows.map((r) => ({
    payeeId: r.payee_id,
    name: r.name,
    reviewOn: r.review_on,
    reviewNote: r.review_note,
    lastDate: r.last_date,
    lastAmountCents: r.last_amount_cents,
    yearCents: r.year_cents,
  }));
}

export async function trackPayee(db: SQLiteDatabase, boardId: number, name: string, reviewOn: string): Promise<void> {
  const payeeId = await findOrCreatePayee(db, boardId, name);
  await db.runAsync(SET_PAYEE_REVIEW, reviewOn, null, payeeId);
}

export async function setReview(db: SQLiteDatabase, item: ReviewItem, reviewOn: string, note: string | null): Promise<void> {
  if (item.schedule) await db.runAsync(SET_SCHEDULE_REVIEW, reviewOn, note, item.schedule.id);
  else if (item.payeeId != null) await db.runAsync(SET_PAYEE_REVIEW, reviewOn, note, item.payeeId);
}

export async function convertSchedule(
  db: SQLiteDatabase,
  scheduleId: number,
  frequency: ScheduleFrequency,
  amountCents: number,
  nextDate: string,
  reviewOn: string,
): Promise<void> {
  await db.runAsync(CONVERT_SCHEDULE, frequency, -Math.abs(amountCents), nextDate, reviewOn, scheduleId);
}

// Recurring → pay as you go: the schedule goes, its payee stays under review.
export async function scheduleToAdHoc(db: SQLiteDatabase, item: ReviewItem, reviewOn: string): Promise<void> {
  if (!item.schedule || item.payeeId == null) return;
  const scheduleId = item.schedule.id;
  const payeeId = item.payeeId;
  await db.withTransactionAsync(async () => {
    await db.runAsync(SET_PAYEE_REVIEW, reviewOn, null, payeeId);
    await scheduledTransactionsRepo.deleteScheduledTransaction(db, scheduleId);
  });
}

// Pay as you go → recurring, built from the payee's last outflow.
export async function adHocToSchedule(
  db: SQLiteDatabase,
  boardId: number,
  item: ReviewItem,
  frequency: ScheduleFrequency,
  amountCents: number,
  nextDate: string,
  reviewOn: string,
): Promise<boolean> {
  if (item.payeeId == null) return false;
  const last = await db.getFirstAsync<{ account_id: number; category_id: number | null; memo: string | null }>(
    LAST_OUTFLOW_FOR_PAYEE,
    item.payeeId,
  );
  if (!last) return false;
  const payeeId = item.payeeId;
  await db.withTransactionAsync(async () => {
    const id = await scheduledTransactionsRepo.createScheduledTransaction(db, boardId, {
      accountId: last.account_id,
      categoryId: last.category_id,
      payeeName: item.name,
      memo: last.memo,
      amountCents: -Math.abs(amountCents),
      frequency,
      intervalN: 1,
      daysOfWeekMask: null,
      nextDate,
      endDate: null,
    });
    await db.runAsync(SET_SCHEDULE_REVIEW, reviewOn, null, id);
    await db.runAsync(SET_PAYEE_REVIEW, null, null, payeeId);
  });
  return true;
}

// Stops the commitment; a refund posts as an inflow back into the same
// account and category the charge came from.
export async function cancel(db: SQLiteDatabase, boardId: number, item: ReviewItem, refundCents: number, today: string): Promise<void> {
  let target: { accountId: number; categoryId: number | null } | null = null;
  if (item.schedule) target = { accountId: item.schedule.accountId, categoryId: item.schedule.categoryId };
  else if (item.payeeId != null) {
    const last = await db.getFirstAsync<{ account_id: number; category_id: number | null }>(LAST_OUTFLOW_FOR_PAYEE, item.payeeId);
    if (last) target = { accountId: last.account_id, categoryId: last.category_id };
  }
  if (refundCents > 0 && target) {
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: target.accountId,
      categoryId: target.categoryId,
      payeeName: item.schedule ? (item.schedule.payeeName ?? '') : item.name,
      memo: 'Refund',
      amountCents: refundCents,
      date: today,
    });
  }
  if (item.schedule) await scheduledTransactionsRepo.deleteScheduledTransaction(db, item.schedule.id);
  else if (item.payeeId != null) await db.runAsync(SET_PAYEE_REVIEW, null, null, item.payeeId);
}
