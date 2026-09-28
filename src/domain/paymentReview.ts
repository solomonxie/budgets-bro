import { addMonths } from '../finance-tools/amortization';
import type { ScheduleFrequency } from './recurrence';
import type { ScheduledTransactionWithLabels } from './types';

// Annual payment review (ABR): every recurring outflow comes up once a year
// for a keep / change / cancel decision. Pure — no DB/React.

export type ReviewCadence = 'monthly' | 'annual' | 'adHoc';
export type ReviewResolution = 'keep' | 'alternative' | 'convert' | 'mode' | 'dismiss' | 'ignore' | 'cancel' | 'restore';

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

// Same payee, same exact amount, more than once — see detectRecurring.
export interface RepeatedCharge {
  payeeId: number;
  name: string;
  amountCents: number; // positive
  dates: string[];
  reviewOn: string | null;
  reviewNote: string | null;
  ignored: boolean;
}

export interface DetectedRecurring {
  payeeId: number;
  name: string;
  amountCents: number;
  cadence: 'monthly' | 'annual';
  firstDate: string;
  lastDate: string;
  nextDate: string;
  reviewOn: string | null;
  reviewNote: string | null;
  ignored: boolean;
}

// How far back detection looks: two annual charges need just over a year.
export const DETECTION_WINDOW_MONTHS = 25;

export interface ReviewItem {
  key: string;
  cadence: ReviewCadence;
  // Found by detectRecurring rather than a schedule or a hand-added payee.
  detected: boolean;
  // Real, but the user chose not to review it — listed under Ignored, never
  // due, left out of the totals.
  ignored: boolean;
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

function daysBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const CADENCES = [
  // Three charges before calling it monthly: two could be coincidence.
  { cadence: 'monthly' as const, minGap: 25, maxGap: 35, minCount: 3, months: 1, staleDays: 45 },
  { cadence: 'annual' as const, minGap: 350, maxGap: 380, minCount: 2, months: 12, staleDays: 400 },
];

// A repeated charge is recurring when most gaps between its dates sit in one
// cadence's band and it is still being paid (the last charge isn't overdue
// by more than half a period).
export function detectRecurring(charges: RepeatedCharge[], today: string): DetectedRecurring[] {
  const found: DetectedRecurring[] = [];
  for (const c of charges) {
    const dates = [...new Set(c.dates)].sort();
    if (dates.length < 2) continue;
    const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d));
    const typical = median(gaps);
    const rule = CADENCES.find((r) => typical >= r.minGap && typical <= r.maxGap);
    if (!rule || dates.length < rule.minCount) continue;
    const inBand = gaps.filter((g) => g >= rule.minGap && g <= rule.maxGap).length;
    if (inBand * 3 < gaps.length * 2) continue;
    const lastDate = dates[dates.length - 1];
    if (daysBetween(lastDate, today) > rule.staleDays) continue;
    found.push({
      payeeId: c.payeeId,
      name: c.name,
      amountCents: c.amountCents,
      cadence: rule.cadence,
      firstDate: dates[0],
      lastDate,
      nextDate: addMonths(lastDate, rule.months),
      reviewOn: c.reviewOn,
      reviewNote: c.reviewNote,
      ignored: c.ignored,
    });
  }
  return found;
}

function scheduleName(s: ScheduledTransactionWithLabels): string {
  return s.payeeName ?? s.memo ?? s.categoryName ?? s.accountName;
}

export function buildReviewItems(
  schedules: ScheduledTransactionWithLabels[],
  adHoc: AdHocPayee[],
  detected: DetectedRecurring[],
  today: string,
): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const s of schedules) {
    if (s.amountCents >= 0) continue;
    const reviewOn = s.reviewOn ?? firstReviewOn(s.frequency, s.nextDate, s.createdAt.slice(0, 10));
    items.push({
      key: `s:${s.id}`,
      cadence: cadenceOf(s.frequency),
      detected: false,
      ignored: s.reviewIgnored,
      name: scheduleName(s),
      amountCents: -s.amountCents,
      yearlyCents: yearlyCents(s.amountCents, s.frequency, s.intervalN),
      reviewOn,
      due: !s.reviewIgnored && reviewOn <= today,
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
      detected: false,
      ignored: false,
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
  for (const d of detected) {
    const reviewOn =
      d.reviewOn ?? (d.cadence === 'annual' ? addDays(d.nextDate, -RENEWAL_NOTICE_DAYS) : addMonths(d.firstDate, 12));
    items.push({
      key: `d:${d.payeeId}:${d.amountCents}`,
      cadence: d.cadence,
      detected: true,
      ignored: d.ignored,
      name: d.name,
      amountCents: d.amountCents,
      yearlyCents: d.cadence === 'annual' ? d.amountCents : d.amountCents * 12,
      reviewOn,
      due: !d.ignored && reviewOn <= today,
      note: d.reviewNote,
      nextDate: d.nextDate,
      lastDate: d.lastDate,
      schedule: null,
      payeeId: d.payeeId,
    });
  }
  return items.sort((a, b) => (a.reviewOn < b.reviewOn ? -1 : a.reviewOn > b.reviewOn ? 1 : a.name.localeCompare(b.name)));
}
