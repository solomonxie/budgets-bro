import { formatMoneyExact } from './money';

export type CategoryStatus =
  'overspent' | 'fully-spent' | 'funded' | 'unbudgeted';

// Cumulative, not per-month: an unspent balance rolls forward automatically
// because this is a running sum, not a reset-each-month calculation.
export function categoryBalanceCents(
  cumulativeAssignedCents: number,
  cumulativeActivityCents: number,
): number {
  return cumulativeAssignedCents + cumulativeActivityCents;
}

// Unassigned Cash = money actually sitting in cash accounts minus money
// already assigned to categories (spent or not) — same identity as a single
// category's balance, just summed over the whole budget instead of one
// category vs. one account.
export function unassignedCashCents(
  cashAccountsBalanceCents: number,
  totalCategoryBalanceCents: number,
): number {
  return cashAccountsBalanceCents - totalCategoryBalanceCents;
}

export interface CategoryMonthTotals {
  month: string; // 'YYYY-MM'
  assignedCents: number;
  activityCents: number;
}

// Every month that overspent, and by how much *that month* did.
//
// A balance is a running sum, so a hole dug in June still shows as a
// negative balance in July, August and September. Those aren't four
// problems — they're June's, seen four times. A month counts here only when
// it made things worse than it found them, and its shortfall is the new
// deficit it added, so fixing each one in turn actually converges.
//
// Past months are closed (see closePastMonths), so in practice this only
// ever finds the current month.
export function overspentMonths(
  months: CategoryMonthTotals[],
): { month: string; shortfallCents: number }[] {
  const found: { month: string; shortfallCents: number }[] = [];
  let balanceCents = 0;
  for (const entry of [...months].sort((a, b) =>
    a.month.localeCompare(b.month),
  )) {
    const before = Math.min(0, balanceCents);
    balanceCents += entry.assignedCents + entry.activityCents;
    const after = Math.min(0, balanceCents);
    if (after < before)
      found.push({ month: entry.month, shortfallCents: before - after });
  }
  return found;
}

// What the category had to spend this month: carried in plus assigned.
export function categoryFundedCents(
  balanceCents: number,
  activityThisMonthCents: number,
): number {
  return balanceCents - activityThisMonthCents;
}

export interface ClosedMonths {
  // New assignment for each past month whose figure changes.
  assigned: { month: string; assignedCents: number }[];
  // Leftover to add on top of the current month's assignment.
  carryCents: number;
}

// Every month before `current` closes at zero: its assignment becomes
// exactly what was spent, a leftover moves up into the next month, and an
// overspend is covered from Unassigned instead of following the category
// around. Walked in order, so a leftover covers a later overspend just as it
// would have had each month been closed on time. Idempotent: once closed,
// past months net zero and this returns nothing.
export function closePastMonths(
  months: CategoryMonthTotals[],
  current: string,
): ClosedMonths {
  const assigned: ClosedMonths['assigned'] = [];
  let carryCents = 0;
  for (const m of [...months].sort((a, b) => a.month.localeCompare(b.month))) {
    if (m.month >= current) continue;
    carryCents = Math.max(0, carryCents + m.assignedCents + m.activityCents);
    const closedCents = -m.activityCents;
    if (closedCents !== m.assignedCents)
      assigned.push({ month: m.month, assignedCents: closedCents });
  }
  return { assigned, carryCents };
}

export function categoryStatus(
  balanceCents: number,
  fundedCents: number,
): CategoryStatus {
  if (balanceCents < 0) return 'overspent';
  if (balanceCents > 0) return 'funded';
  return fundedCents === 0 ? 'unbudgeted' : 'fully-spent';
}

// Exact cents, not whole dollars: a category sitting at −40¢ is overspent,
// and rounding it to "Overspent by $0" reads as a bug rather than as the
// forty cents it is.
export function categoryCaption(
  status: CategoryStatus,
  spentThisMonthCents: number,
  fundedCents: number,
  balanceCents: number,
): string {
  switch (status) {
    case 'overspent':
      return `Overspent by ${formatMoneyExact(-balanceCents)}`;
    case 'unbudgeted':
      return 'Not budgeted';
    case 'fully-spent':
      return `Fully spent ${formatMoneyExact(spentThisMonthCents)}`;
    default:
      return spentThisMonthCents > 0
        ? `Spent ${formatMoneyExact(spentThisMonthCents)} of ${formatMoneyExact(fundedCents)}`
        : 'Funded';
  }
}

export function accountBalanceCents(
  openingBalanceCents: number,
  transactionAmountsCents: number[],
): number {
  return transactionAmountsCents.reduce(
    (sum, amount) => sum + amount,
    openingBalanceCents,
  );
}

export interface CategoryBarSegments {
  spentPercent: number;
  remainingPercent: number;
}

// How a category's bar is split between what has been spent and what is
// still in the envelope, against the two together rather than against what
// was assigned this month — so a category carrying a balance forward reads
// truthfully instead of pinning at 100% the moment this month's assignment
// is used up.
//
// Both zero means there is nothing to draw: nothing assigned and nothing
// spent, or an overspent category, which the caller colours as a whole
// rather than splitting (there is no "remaining" to show).
export function categoryBarSegments(
  balanceCents: number,
  spentThisMonthCents: number,
): CategoryBarSegments {
  const spent = Math.max(0, spentThisMonthCents);
  const remaining = Math.max(0, balanceCents);
  const total = spent + remaining;
  if (total <= 0) return { spentPercent: 0, remainingPercent: 0 };
  const spentPercent = (spent / total) * 100;
  return { spentPercent, remainingPercent: 100 - spentPercent };
}

// Averaged from the category's first month with any activity in the window,
// so one started in March isn't diluted by the empty months before it.
export function averageMonthlySpentCents(
  activityByMonth: Record<string, number>,
  months: string[],
): number {
  const first = months.findIndex((m) => activityByMonth[m]);
  if (first < 0) return 0;
  const span = months.slice(first);
  const spent = span.reduce(
    (sum, m) => sum + Math.max(0, -(activityByMonth[m] ?? 0)),
    0,
  );
  return Math.round(spent / span.length);
}

// Past this share of the usual month, the overshoot turns from amber to red.
export const OVER_AVERAGE_RED_RATIO = 1.2;

export interface CategoryPaceBar {
  usualPercent: number;
  overPercent: number;
  overRed: boolean;
  leftPercent: number;
  averagePercent: number;
}

// This month's spending against the usual month: green up to the average,
// the overshoot after it, then what is still in the envelope. The track is
// at least 1.5x the average so the mark sits in the same place on most rows.
// Null with no history to compare against.
export function categoryPaceBar(
  balanceCents: number,
  spentThisMonthCents: number,
  averageSpentCents: number,
): CategoryPaceBar | null {
  if (averageSpentCents <= 0) return null;
  const spent = Math.max(0, spentThisMonthCents);
  const left = Math.max(0, balanceCents);
  const scale = Math.max(averageSpentCents * 1.5, spent + left);
  const percent = (cents: number) => (cents / scale) * 100;
  return {
    usualPercent: percent(Math.min(spent, averageSpentCents)),
    overPercent: percent(Math.max(0, spent - averageSpentCents)),
    overRed: spent > averageSpentCents * OVER_AVERAGE_RED_RATIO,
    leftPercent: percent(left),
    averagePercent: percent(averageSpentCents),
  };
}
