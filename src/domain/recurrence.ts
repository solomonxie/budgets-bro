import { addMonths } from '../finance-tools/amortization';

// Pure recurrence math for scheduled transactions (T8.7) — no DB/React
// dependency, same split as budgetMath.ts/amortization.ts.

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Bit i = 1<<i for weekday i, Sunday=0..Saturday=6 (JS Date's own
// getUTCDay() order) — only meaningful when frequency is 'weekly'. `null`
// means "whatever weekday the schedule's date already falls on" (every
// schedule created before multi-weekday support existed, and the common
// single-day case going forward).
export const SUNDAY = 1 << 0;
export const MONDAY = 1 << 1;
export const TUESDAY = 1 << 2;
export const WEDNESDAY = 1 << 3;
export const THURSDAY = 1 << 4;
export const FRIDAY = 1 << 5;
export const SATURDAY = 1 << 6;
export const WEEKDAYS_MASK = MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY;
export const WEEKEND_MASK = SATURDAY | SUNDAY;
export const ALL_DAYS_MASK = WEEKDAYS_MASK | WEEKEND_MASK;

export interface RecurrenceRule {
  frequency: ScheduleFrequency;
  intervalN: number;
  daysOfWeekMask: number | null;
}

function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function weekdayOf(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function startOfWeek(dateIso: string): string {
  return addDays(dateIso, -weekdayOf(dateIso));
}

function weeksBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const days = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  return Math.floor(days / 7);
}

// Next weekly occurrence after `date` that (a) falls on one of
// `daysOfWeekMask`'s days and (b) lands in a week that's a multiple of
// `intervalN` weeks after `anchorDate`'s week — so "every 2 weeks on Mon
// & Thu" fires both days in the same active week, then skips a week,
// rather than treating each selected weekday as its own independent
// cadence. `anchorDate` is the schedule's creation date (see
// scheduledTransactionsRepo) — fixed once, so editing intervalN/days
// later doesn't retroactively shift which weeks were "active" before.
function nextWeeklyMultiDay(date: string, intervalN: number, daysOfWeekMask: number, anchorDate: string): string {
  const anchorWeekStart = startOfWeek(anchorDate);
  let candidate = addDays(date, 1);
  const searchLimitDays = 7 * intervalN + 7;
  for (let i = 0; i < searchLimitDays; i++) {
    const weeksFromAnchor = weeksBetween(anchorWeekStart, startOfWeek(candidate));
    if (weeksFromAnchor % intervalN === 0 && (daysOfWeekMask & (1 << weekdayOf(candidate))) !== 0) {
      return candidate;
    }
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

// Next occurrence after `date`, `intervalN` periods out (e.g. monthly/2 =
// every other month). Daily/weekly step in days; monthly/yearly reuse
// amortization.ts's addMonths so month-end dates (e.g. Jan 31) roll over
// the same way a loan schedule already does, rather than a second,
// possibly-inconsistent implementation. `daysOfWeekMask`/`anchorDate` are
// only consulted for a weekly schedule pinned to specific weekday(s); omit
// both (or pass null) for the plain "N weeks from the last occurrence"
// case every non-weekly frequency, and pre-multi-weekday schedules, use.
export function nextOccurrenceDate(
  date: string,
  frequency: ScheduleFrequency,
  intervalN: number,
  daysOfWeekMask?: number | null,
  anchorDate?: string,
): string {
  const n = Math.max(1, intervalN);
  switch (frequency) {
    case 'daily':
      return addDays(date, n);
    case 'weekly':
      if (daysOfWeekMask != null && anchorDate != null) return nextWeeklyMultiDay(date, n, daysOfWeekMask, anchorDate);
      return addDays(date, 7 * n);
    case 'monthly':
      return addMonths(date, n);
    case 'yearly':
      return addMonths(date, 12 * n);
  }
}

export type RecurrencePresetKey =
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'every3Months'
  | 'every6Months'
  | 'yearly';

const PRESET_RULES: Record<RecurrencePresetKey, RecurrenceRule> = {
  daily: { frequency: 'daily', intervalN: 1, daysOfWeekMask: null },
  weekdays: { frequency: 'weekly', intervalN: 1, daysOfWeekMask: WEEKDAYS_MASK },
  weekends: { frequency: 'weekly', intervalN: 1, daysOfWeekMask: WEEKEND_MASK },
  weekly: { frequency: 'weekly', intervalN: 1, daysOfWeekMask: null },
  biweekly: { frequency: 'weekly', intervalN: 2, daysOfWeekMask: null },
  monthly: { frequency: 'monthly', intervalN: 1, daysOfWeekMask: null },
  every3Months: { frequency: 'monthly', intervalN: 3, daysOfWeekMask: null },
  every6Months: { frequency: 'monthly', intervalN: 6, daysOfWeekMask: null },
  yearly: { frequency: 'yearly', intervalN: 1, daysOfWeekMask: null },
};

export const RECURRENCE_PRESET_KEYS = Object.keys(PRESET_RULES) as RecurrencePresetKey[];

export function ruleForPreset(key: RecurrencePresetKey): RecurrenceRule {
  return PRESET_RULES[key];
}

// Reverse lookup for the field's closed-state label — a rule matches a
// preset only if every part matches, `daysOfWeekMask` included (`null`
// and `0` are kept distinct so "no custom days" vs. "every box unchecked"
// never both read as some preset by accident). Returns null for anything
// that needs the "Custom" label instead (e.g. "every 5 days" or "every 2
// weeks on Tue/Fri").
export function matchPreset(rule: RecurrenceRule): RecurrencePresetKey | null {
  for (const key of RECURRENCE_PRESET_KEYS) {
    const preset = PRESET_RULES[key];
    if (preset.frequency === rule.frequency && preset.intervalN === rule.intervalN && preset.daysOfWeekMask === rule.daysOfWeekMask) {
      return key;
    }
  }
  return null;
}
