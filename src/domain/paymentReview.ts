import { addMonths } from '../finance-tools/amortization';
import type { ScheduleFrequency } from './recurrence';
import type { ScheduledTransactionWithLabels } from './types';

// Annual payment review (ABR): every recurring outflow comes up once a year
// for a keep / change / cancel decision. Pure — no DB/React.

export type ReviewCadence = 'monthly' | 'annual' | 'adHoc';
export type ReviewResolution = 'keep' | 'alternative' | 'convert' | 'mode' | 'cancel';

// An annual charge comes up this long before it renews — time to cancel.
export const RENEWAL_NOTICE_DAYS = 30;
// "Find an alternative" checks back after this long.
export const ALTERNATIVE_CHECK_DAYS = 30;

export interface AdHocPayee {
  payeeId: number;
  name: string;
  reviewOn: string;
  reviewNote: string | null;
  lastDate: string | null;
  lastAmountCents: number | null; // positive
  yearCents: number; // positive, last 12 months
}

export interface ReviewItem {
  key: string;
  cadence: ReviewCadence;
  name: string;
  amountCents: number; // positive, per charge
  yearlyCents: number;
  reviewOn: string;
  due: boolean;
  note: string | null;
  nextDate: string | null;
  lastDate: string | null;
  schedule: ScheduledTransactionWithLabels | null;
  payeeId: number | null;
}

export function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function cadenceOf(frequency: ScheduleFrequency): 'monthly' | 'annual' {
  return frequency === 'yearly' ? 'annual' : 'monthly';
}

const PER_YEAR: Record<ScheduleFrequency, number> = { daily: 365, weekly: 52, monthly: 12, yearly: 1 };

export function yearlyCents(amountCents: number, frequency: ScheduleFrequency, intervalN: number): number {
  return Math.round((Math.abs(amountCents) * PER_YEAR[frequency]) / Math.max(1, intervalN));
}

export function firstReviewOn(frequency: ScheduleFrequency, nextDate: string, createdOn: string): string {
  return frequency === 'yearly' ? addDays(nextDate, -RENEWAL_NOTICE_DAYS) : addMonths(createdOn, 12);
}

// After "keep": an annual charge comes up again before the renewal after
// this one; anything else a year from today.
export function reviewOnAfterKeeping(frequency: ScheduleFrequency | null, nextDate: string | null, today: string): string {
  if (frequency === 'yearly' && nextDate != null) {
    const renewal = nextDate > today ? nextDate : today;
    return addDays(addMonths(renewal, 12), -RENEWAL_NOTICE_DAYS);
  }
  return addMonths(today, 12);
}

// Monthly ↔ annual at the same yearly cost; the user edits it to the real
// price (annual plans are usually discounted).
export function convertedFrequency(frequency: ScheduleFrequency): ScheduleFrequency {
  return frequency === 'yearly' ? 'monthly' : 'yearly';
}

export function convertedAmountCents(amountCents: number, frequency: ScheduleFrequency, intervalN: number): number {
  const perYear = yearlyCents(amountCents, frequency, intervalN);
  return convertedFrequency(frequency) === 'yearly' ? perYear : Math.round(perYear / 12);
}

// First date strictly after today that keeps `fromDate`'s day of month.
export function nextMonthlyDateAfter(fromDate: string, today: string): string {
  let next = addMonths(fromDate, 1);
  for (let i = 1; next <= today && i < 1200; i++) next = addMonths(fromDate, i + 1);
  return next;
}

function scheduleName(s: ScheduledTransactionWithLabels): string {
  return s.payeeName ?? s.memo ?? s.categoryName ?? s.accountName;
}

export function buildReviewItems(
  schedules: ScheduledTransactionWithLabels[],
  adHoc: AdHocPayee[],
  today: string,
): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const s of schedules) {
    if (s.amountCents >= 0) continue;
    const reviewOn = s.reviewOn ?? firstReviewOn(s.frequency, s.nextDate, s.createdAt.slice(0, 10));
    items.push({
      key: `s:${s.id}`,
      cadence: cadenceOf(s.frequency),
      name: scheduleName(s),
      amountCents: -s.amountCents,
      yearlyCents: yearlyCents(s.amountCents, s.frequency, s.intervalN),
      reviewOn,
      due: reviewOn <= today,
      note: s.reviewNote,
      nextDate: s.nextDate,
      lastDate: null,
      schedule: s,
      payeeId: s.payeeId,
    });
  }
  for (const p of adHoc) {
    items.push({
      key: `p:${p.payeeId}`,
      cadence: 'adHoc',
      name: p.name,
      amountCents: p.lastAmountCents ?? 0,
      yearlyCents: p.yearCents,
      reviewOn: p.reviewOn,
      due: p.reviewOn <= today,
      note: p.reviewNote,
      nextDate: null,
      lastDate: p.lastDate,
      schedule: null,
      payeeId: p.payeeId,
    });
  }
  return items.sort((a, b) => (a.reviewOn < b.reviewOn ? -1 : a.reviewOn > b.reviewOn ? 1 : a.name.localeCompare(b.name)));
}
