// Runway: how many months the money you have would last if income stopped
// today — cash on hand over what a month typically costs. Unlike YNAB's Age
// of Money it is one division anyone can check by hand.

export type RunwayLevel = 'paycheck' | 'thin' | 'covered' | 'strong';

// Under one month is living paycheck to paycheck; three to six is Ramsey's
// full emergency fund.
export function runwayLevel(months: number): RunwayLevel {
  if (months < 1) return 'paycheck';
  if (months < 3) return 'thin';
  if (months < 6) return 'covered';
  return 'strong';
}

export const COST_WINDOW_MONTHS = 12;

export interface RunwayMonth {
  month: string;
  netCents: number;
  costCents: number;
}

export interface RunwayPoint {
  month: string;
  cashCents: number;
  avgCostCents: number;
  // Null with no cost history to divide by.
  months: number | null;
}

// `months` is every month from the first with activity to the current one.
// The current month's cash is today's; its cost is still accruing, so its
// average is taken over the months before it.
export function runwayTrend({
  months,
  openingCents,
  activity,
  currentMonth,
}: {
  months: string[];
  openingCents: number;
  activity: RunwayMonth[];
  currentMonth: string;
}): RunwayPoint[] {
  const byMonth = new Map(activity.map((a) => [a.month, a]));
  const costs = months.map((m) => byMonth.get(m)?.costCents ?? 0);
  let cashCents = openingCents;
  return months.map((month, i) => {
    cashCents += byMonth.get(month)?.netCents ?? 0;
    const end = month === currentMonth ? i : i + 1;
    const window = costs.slice(Math.max(0, end - COST_WINDOW_MONTHS), end);
    const avgCostCents =
      window.length > 0
        ? Math.round(window.reduce((s, c) => s + c, 0) / window.length)
        : 0;
    return {
      month,
      cashCents,
      avgCostCents,
      months:
        avgCostCents > 0 ? Math.max(0, cashCents) / avgCostCents : null,
    };
  });
}

// How many of the last `n` months ended with less than a month in hand.
export function paycheckToPaycheckCount(points: RunwayPoint[], n = 12): number {
  return points
    .slice(-n)
    .filter((p) => p.months != null && runwayLevel(p.months) === 'paycheck')
    .length;
}

// Each month's average runway over the `n` months ending with it — the
// benchmark line, so a month reads against its own recent past.
export function rollingAverageMonths(points: RunwayPoint[], n = 12): (number | null)[] {
  return points.map((_, i) => {
    const window = points
      .slice(Math.max(0, i - n + 1), i + 1)
      .flatMap((p) => (p.months == null ? [] : [p.months]));
    return window.length > 0 ? window.reduce((s, m) => s + m, 0) / window.length : null;
  });
}
