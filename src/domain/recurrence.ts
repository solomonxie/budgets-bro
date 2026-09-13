import { addMonths } from '../finance-tools/amortization';

// Pure recurrence math for scheduled transactions (T8.7) — no DB/React
// dependency, same split as budgetMath.ts/amortization.ts.

export type ScheduleFrequency = 'weekly' | 'monthly' | 'yearly';

function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

// Next occurrence after `date`, `intervalN` periods out (e.g. monthly/2 =
// every other month). Weekly steps in days; monthly/yearly reuse
// amortization.ts's addMonths so month-end dates (e.g. Jan 31) roll over
// the same way a loan schedule already does, rather than a second,
// possibly-inconsistent implementation.
export function nextOccurrenceDate(date: string, frequency: ScheduleFrequency, intervalN: number): string {
  const n = Math.max(1, intervalN);
  switch (frequency) {
    case 'weekly':
      return addDays(date, 7 * n);
    case 'monthly':
      return addMonths(date, n);
    case 'yearly':
      return addMonths(date, 12 * n);
  }
}
