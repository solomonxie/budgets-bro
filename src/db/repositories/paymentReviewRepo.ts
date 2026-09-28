import type { SQLiteDatabase } from '../driver';
import type { PaymentDecisionRow, ScheduledTransactionJoinRow } from '../schema';
import { ACTION_DECISIONS } from '../../domain/paymentReview';
import type { AdHocPayee, Decision, PaymentDecision, RepeatedCharge, ReviewCadence, ReviewItem } from '../../domain/paymentReview';
import type { ScheduledTransactionWithLabels } from '../../domain/types';
import * as scheduledTransactionsRepo from './scheduledTransactionsRepo';
import {
  LIST_REVIEWABLE_SCHEDULES,
  LIST_AD_HOC,
  LIST_REPEATED_CHARGES,
  SET_SCHEDULE_REVIEW,
  SET_SCHEDULE_IGNORED,
  SET_PAYEE_REVIEW_MODE,
  FIND_PAYEE,
  LIST_DECISIONS,
  INSERT_DECISION,
  MARK_DECISION_DONE,
  DELETE_DECISION,
} from '../../../databases/queries/paymentReview';

// Only ABR's own state lives here: review dates and modes on schedules and
// payees, and the decisions log. Nothing in this file writes a transaction
// or creates, edits or deletes a schedule.

type PayeeReviewMode = 'adHoc' | 'dismissed' | 'ignored' | null;

interface AdHocRow {
  payee_id: number;
  name: string;
  review_on: string;
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
    lastDate: r.last_date,
    lastAmountCents: r.last_amount_cents,
    yearCents: r.year_cents,
  }));
}

export async function listRepeatedCharges(db: SQLiteDatabase, boardId: number, since: string): Promise<RepeatedCharge[]> {
  const rows = await db.getAllAsync<RepeatedChargeRow>(LIST_REPEATED_CHARGES, boardId, since, boardId);
  return rows.map((r) => ({
    payeeId: r.payee_id,
    name: r.name,
    amountCents: r.amount_cents,
    dates: r.dates.split(','),
    reviewOn: r.review_mode === 'dismissed' ? null : r.review_on,
    ignored: r.review_mode === 'ignored',
  }));
}

export async function listDecisions(db: SQLiteDatabase, boardId: number): Promise<PaymentDecision[]> {
  const rows = await db.getAllAsync<PaymentDecisionRow>(LIST_DECISIONS, boardId);
  return rows.map((r) => ({
    id: r.id,
    scheduleId: r.scheduled_transaction_id,
    payeeId: r.payee_id,
    name: r.name,
    cadence: r.cadence as ReviewCadence,
    amountCents: r.amount_cents,
    decision: r.decision as Decision,
    note: r.note,
    decidedOn: r.decided_on,
    dueOn: r.due_on,
    doneOn: r.done_on,
  }));
}

async function setPayeeReview(db: SQLiteDatabase, payeeId: number, mode: PayeeReviewMode, reviewOn: string | null) {
  await db.runAsync(SET_PAYEE_REVIEW_MODE, mode, reviewOn, payeeId);
}

// Existing payees only — adding one to the review mustn't create a payee.
export async function trackPayee(db: SQLiteDatabase, boardId: number, name: string, reviewOn: string): Promise<void> {
  const row = await db.getFirstAsync<{ id: number }>(FIND_PAYEE, boardId, name.trim());
  if (row) await setPayeeReview(db, row.id, 'adHoc', reviewOn);
}

async function applyToItem(db: SQLiteDatabase, item: ReviewItem, decision: Decision, nextReviewOn: string, today: string) {
  const payeeId = item.payeeId;
  if (decision === 'ignore' || decision === 'restore') {
    const ignored = decision === 'ignore';
    if (item.schedule) await db.runAsync(SET_SCHEDULE_IGNORED, ignored ? 1 : 0, item.schedule.id);
    else if (payeeId != null) await setPayeeReview(db, payeeId, ignored ? 'ignored' : null, null);
  } else if (decision === 'dismiss') {
    // Only charges after today can bring it back (see LIST_REPEATED_CHARGES).
    if (payeeId != null) await setPayeeReview(db, payeeId, 'dismissed', today);
  } else if (item.schedule) {
    await db.runAsync(SET_SCHEDULE_REVIEW, nextReviewOn, item.schedule.id);
  } else if (payeeId != null) {
    await setPayeeReview(db, payeeId, item.cadence === 'adHoc' ? 'adHoc' : null, nextReviewOn);
  }
}

// Records a decision and settles the item's review. An action decision is
// left open as a reminder (`dueOn`); anything else is logged as done today.
export async function decide(
  db: SQLiteDatabase,
  boardId: number,
  item: ReviewItem,
  decision: Decision,
  { note, dueOn, nextReviewOn, today }: { note: string | null; dueOn: string | null; nextReviewOn: string; today: string },
): Promise<void> {
  const isAction = ACTION_DECISIONS.includes(decision);
  await db.withTransactionAsync(async () => {
    await applyToItem(db, item, decision, nextReviewOn, today);
    await db.runAsync(
      INSERT_DECISION,
      boardId,
      item.schedule?.id ?? null,
      item.payeeId,
      item.name,
      item.cadence,
      item.amountCents,
      decision,
      note,
      today,
      isAction ? dueOn : null,
      isAction ? null : today,
    );
  });
}

export async function markDecisionDone(db: SQLiteDatabase, id: number, today: string): Promise<void> {
  await db.runAsync(MARK_DECISION_DONE, today, id);
}

export async function deleteDecision(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(DELETE_DECISION, id);
}
