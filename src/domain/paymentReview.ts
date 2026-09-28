import { addMonths } from '../finance-tools/amortization';
import type { ScheduleFrequency } from './recurrence';
import type { ScheduledTransactionWithLabels } from './types';

// Quarterly payment review (QBR): every recurring outflow comes up each
// calendar quarter for a decision, and a decision holds only until the next
// quarter starts — except Ignore, which holds until Restore. Decisions never touch transactions or schedules — one that
// needs doing becomes a reminder for the user. Pure — no DB/React.

export type ReviewCadence = 'monthly' | 'annual';
export type Decision = 'keep' | 'alternative' | 'convert' | 'mode' | 'cancel' | 'dismiss' | 'ignore' | 'restore';

// Decisions the user still has to carry out themselves: logged as a
// reminder with a due date until marked done. The rest are done on the spot.
export const ACTION_DECISIONS: readonly Decision[] = ['alternative', 'convert', 'mode', 'cancel'];

export interface PaymentDecision {
  id: number;
  scheduleId: number | null;
  payeeId: number | null;
  name: string;
  cadence: ReviewCadence;
  amountCents: number;
  decision: Decision;
  note: string | null;
  decidedOn: string;
  dueOn: string | null;
  doneOn: string | null;
}

// Default time to find an alternative; other actions are due before the
// next charge, or in a week when there's no known next charge.
export const ALTERNATIVE_DAYS = 30;
export const ACTION_DAYS = 7;

// Same payee, same exact amount, more than once — see detectRecurring.
export interface RepeatedCharge {
  payeeId: number;
  name: string;
  amountCents: number; // positive
  dates: string[];
  categoryId: number | null; // of the latest charge
  reviewOn: string | null;
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
  categoryId: number | null;
  reviewOn: string | null;
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
  // Decided this quarter: its review date comes from a decision, not yet due.
  decided: boolean;
  nextDate: string | null;
  lastDate: string | null;
  schedule: ScheduledTransactionWithLabels | null;
  payeeId: number | null;
  categoryId: number | null;
}

// Payees and categories left out of the review. Stored as exclusions so
// everything — including a payee or category added later — is in by default.
export interface ReviewFilter {
  payeeIds: number[];
  categoryIds: number[];
}

export const NO_REVIEW_FILTER: ReviewFilter = { payeeIds: [], categoryIds: [] };

// Items outside the filter aren't in the review at all: not listed, never
// due, not in the total.
export function applyReviewFilter(items: ReviewItem[], filter: ReviewFilter): ReviewItem[] {
  if (filter.payeeIds.length === 0 && filter.categoryIds.length === 0) return items;
  const payees = new Set(filter.payeeIds);
  const categories = new Set(filter.categoryIds);
  return items.filter(
    (i) => !(i.payeeId != null && payees.has(i.payeeId)) && !(i.categoryId != null && categories.has(i.categoryId)),
  );
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

// First day of the quarter after the one `dateIso` falls in.
export function nextQuarterStart(dateIso: string): string {
  const [y, m] = dateIso.split('-').map(Number);
  const q = Math.floor((m - 1) / 3) + 1;
  return q === 4 ? `${y + 1}-01-01` : `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
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
      categoryId: c.categoryId,
      reviewOn: c.reviewOn,
      ignored: c.ignored,
    });
  }
  return found;
}

// Same key as the ReviewItem it was made for.
export function decisionItemKey(d: PaymentDecision): string {
  if (d.scheduleId != null) return `s:${d.scheduleId}`;
  return `d:${d.payeeId}:${d.amountCents}`;
}

export function defaultDueOn(item: ReviewItem, decision: Decision, today: string): string {
  if (decision === 'alternative') return addDays(today, ALTERNATIVE_DAYS);
  if (item.nextDate && item.nextDate > today) {
    const dayBefore = addDays(item.nextDate, -1);
    return dayBefore > today ? dayBefore : today;
  }
  return addDays(today, ACTION_DAYS);
}

// A decision holds until next quarter's review (Ignore aside — see decide).
export function reviewOnAfterDecision(today: string): string {
  return nextQuarterStart(today);
}

function scheduleName(s: ScheduledTransactionWithLabels): string {
  return s.payeeName ?? s.memo ?? s.categoryName ?? s.accountName;
}

export function buildReviewItems(
  schedules: ScheduledTransactionWithLabels[],
  detected: DetectedRecurring[],
  today: string,
): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const s of schedules) {
    if (s.amountCents >= 0) continue;
    const reviewOn = s.reviewOn ?? nextQuarterStart(s.createdAt.slice(0, 10));
    const ignored = s.reviewIgnored;
    items.push({
      key: `s:${s.id}`,
      cadence: cadenceOf(s.frequency),
      detected: false,
      ignored,
      name: scheduleName(s),
      amountCents: -s.amountCents,
      yearlyCents: yearlyCents(s.amountCents, s.frequency, s.intervalN),
      reviewOn,
      due: !ignored && reviewOn <= today,
      decided: s.reviewOn != null && reviewOn > today,
      nextDate: s.nextDate,
      lastDate: null,
      schedule: s,
      payeeId: s.payeeId,
      categoryId: s.categoryId,
    });
  }
  for (const d of detected) {
    const reviewOn = d.reviewOn ?? nextQuarterStart(d.firstDate);
    const ignored = d.ignored;
    items.push({
      key: `d:${d.payeeId}:${d.amountCents}`,
      cadence: d.cadence,
      detected: true,
      ignored,
      name: d.name,
      amountCents: d.amountCents,
      yearlyCents: d.cadence === 'annual' ? d.amountCents : d.amountCents * 12,
      reviewOn,
      due: !ignored && reviewOn <= today,
      decided: d.reviewOn != null && reviewOn > today,
      nextDate: d.nextDate,
      lastDate: d.lastDate,
      schedule: null,
      payeeId: d.payeeId,
      categoryId: d.categoryId,
    });
  }
  return items.sort((a, b) => (a.reviewOn < b.reviewOn ? -1 : a.reviewOn > b.reviewOn ? 1 : a.name.localeCompare(b.name)));
}
