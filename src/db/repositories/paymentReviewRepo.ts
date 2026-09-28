import type { SQLiteDatabase } from '../driver';
import type { ScheduledTransactionJoinRow } from '../schema';
import type { AdHocPayee, RepeatedCharge, ReviewItem } from '../../domain/paymentReview';
import type { ScheduleFrequency } from '../../domain/recurrence';
import type { ScheduledTransactionWithLabels } from '../../domain/types';
import { findOrCreatePayee } from './payeesRepo';
import * as scheduledTransactionsRepo from './scheduledTransactionsRepo';
import * as transactionsRepo from './transactionsRepo';
import {
  LIST_REVIEWABLE_SCHEDULES,
  LIST_AD_HOC,
  LIST_REPEATED_CHARGES,
  LAST_OUTFLOW_FOR_PAYEE,
  SET_SCHEDULE_REVIEW,
  SET_SCHEDULE_IGNORED,
  SET_PAYEE_REVIEW_MODE,
  CONVERT_SCHEDULE,
} from '../../../databases/queries/paymentReview';

type PayeeReviewMode = 'adHoc' | 'dismissed' | 'ignored' | null;

interface AdHocRow {
  payee_id: number;
  name: string;
  review_on: string;
  review_note: string | null;
  last_date: string | null;
  last_amount_cents: number | null;
  year_cents: number;
}

interface RepeatedChargeRow {
  payee_id: number;
  name: string;
  amount_cents: number;
  dates: string;
  review_on: string | null;
  review_note: string | null;
  review_mode: string | null;
}

export async function listReviewableSchedules(db: SQLiteDatabase, boardId: number): Promise<ScheduledTransactionWithLabels[]> {
  const rows = await db.getAllAsync<ScheduledTransactionJoinRow>(LIST_REVIEWABLE_SCHEDULES, boardId);
  return rows.map(scheduledTransactionsRepo.mapRow);
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

export async function listRepeatedCharges(db: SQLiteDatabase, boardId: number, since: string): Promise<RepeatedCharge[]> {
  const rows = await db.getAllAsync<RepeatedChargeRow>(LIST_REPEATED_CHARGES, boardId, since, boardId);
  return rows.map((r) => {
    const dismissed = r.review_mode === 'dismissed';
    return {
      payeeId: r.payee_id,
      name: r.name,
      amountCents: r.amount_cents,
      dates: r.dates.split(','),
      reviewOn: dismissed ? null : r.review_on,
      reviewNote: dismissed ? null : r.review_note,
      ignored: r.review_mode === 'ignored',
    };
  });
}

async function setPayeeReview(db: SQLiteDatabase, payeeId: number, mode: PayeeReviewMode, reviewOn: string | null, note: string | null) {
  await db.runAsync(SET_PAYEE_REVIEW_MODE, mode, reviewOn, note, payeeId);
}

export async function trackPayee(db: SQLiteDatabase, boardId: number, name: string, reviewOn: string): Promise<void> {
  const payeeId = await findOrCreatePayee(db, boardId, name);
  if (payeeId != null) await setPayeeReview(db, payeeId, 'adHoc', reviewOn, null);
}

export async function setReview(db: SQLiteDatabase, item: ReviewItem, reviewOn: string, note: string | null): Promise<void> {
  if (item.schedule) await db.runAsync(SET_SCHEDULE_REVIEW, reviewOn, note, item.schedule.id);
  else if (item.payeeId != null) await setPayeeReview(db, item.payeeId, item.cadence === 'adHoc' ? 'adHoc' : null, reviewOn, note);
}

// "Not recurring": a detected pattern the user says isn't a commitment. Only
// charges after today can bring it back.
export async function dismiss(db: SQLiteDatabase, item: ReviewItem, today: string): Promise<void> {
  if (item.payeeId != null) await setPayeeReview(db, item.payeeId, 'dismissed', today, null);
}

// Ignore: still listed (under Ignored), never due. Restore clears the review
// state too, so it comes back on its default schedule.
export async function setIgnored(db: SQLiteDatabase, item: ReviewItem, ignored: boolean): Promise<void> {
  if (item.schedule) await db.runAsync(SET_SCHEDULE_IGNORED, ignored ? 1 : 0, item.schedule.id);
  else if (item.payeeId != null) await setPayeeReview(db, item.payeeId, ignored ? 'ignored' : null, null, null);
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
    await setPayeeReview(db, payeeId, 'adHoc', reviewOn, null);
    await scheduledTransactionsRepo.deleteScheduledTransaction(db, scheduleId);
  });
}

// Ad hoc or detected → a real schedule, built from the payee's last outflow.
export async function toSchedule(
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
    await setPayeeReview(db, payeeId, null, null, null);
  });
  return true;
}

// Stops the commitment; a refund posts as an inflow back into the same
// account and category the charge came from. The payee is dismissed so past
// charges don't bring it straight back as detected.
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
  if (item.payeeId != null) await setPayeeReview(db, item.payeeId, 'dismissed', today, null);
}
