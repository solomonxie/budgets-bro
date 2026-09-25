import { nextMonth } from './month';

// How far a step is from done at the rate it has actually been moving: the
// last 12 months' average net flow, projected forward in a straight line. No
// interest, no raises — a pace, not a forecast.

// Past this, a date means nothing; "decades" says it better.
const MAX_MONTHS = 600;

export type Pace =
  | { kind: 'done' }
  // Not moving toward the target at all, or moving away from it.
  | { kind: 'stalled' }
  | { kind: 'eta'; monthlyCents: number; months: number; doneBy: string }
  | { kind: 'far'; monthlyCents: number };

export function paceToTarget(
  currentCents: number,
  targetCents: number,
  monthlyCents: number,
  fromMonth: string,
): Pace {
  const remaining = targetCents - currentCents;
  if (remaining <= 0) return { kind: 'done' };
  if (monthlyCents <= 0) return { kind: 'stalled' };
  const months = Math.ceil(remaining / monthlyCents);
  if (months > MAX_MONTHS) return { kind: 'far', monthlyCents };
  let doneBy = fromMonth;
  for (let i = 0; i < months; i++) doneBy = nextMonth(doneBy);
  return { kind: 'eta', monthlyCents, months, doneBy };
}

// A debt step: the target is zero owed, and paying down is the progress.
export function paceToPayoff(
  owedCents: number,
  paidDownPerMonthCents: number,
  fromMonth: string,
): Pace {
  return paceToTarget(0, owedCents, paidDownPerMonthCents, fromMonth);
}

// Where the year ends up if the rest of it goes like the part so far.
export function projectYearEnd(
  soFarCents: number,
  monthsElapsed: number,
): number {
  if (monthsElapsed <= 0) return soFarCents;
  return Math.round((soFarCents / monthsElapsed) * 12);
}
