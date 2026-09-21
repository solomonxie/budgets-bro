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
// The month matters as much as the amount: money has to be assigned into
// the month that broke. Assigning it in whatever month you happen to be
// looking at leaves the broken one still reading as overspent, however much
// you put in.
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

export function categoryStatus(
  balanceCents: number,
  assignedThisMonthCents: number,
): CategoryStatus {
  if (balanceCents < 0) return 'overspent';
  if (assignedThisMonthCents === 0) return 'unbudgeted';
  if (balanceCents === 0) return 'fully-spent';
  return 'funded';
}

// Exact cents, not whole dollars: a category sitting at −40¢ is overspent,
// and rounding it to "Overspent by $0" reads as a bug rather than as the
// forty cents it is.
export function categoryCaption(
  status: CategoryStatus,
  spentThisMonthCents: number,
  assignedThisMonthCents: number,
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
        ? `Spent ${formatMoneyExact(spentThisMonthCents)} of ${formatMoneyExact(assignedThisMonthCents)}`
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
