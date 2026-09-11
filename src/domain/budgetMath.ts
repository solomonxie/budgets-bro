import { formatMoney } from './money';

export type CategoryStatus = 'overspent' | 'fully-spent' | 'funded' | 'unbudgeted';

// Cumulative, not per-month: an unspent balance rolls forward automatically
// because this is a running sum, not a reset-each-month calculation.
export function categoryBalanceCents(cumulativeAssignedCents: number, cumulativeActivityCents: number): number {
  return cumulativeAssignedCents + cumulativeActivityCents;
}

// Unassigned Cash = money actually sitting in cash accounts minus money
// already assigned to categories (spent or not) — same identity as a single
// category's balance, just summed over the whole budget instead of one
// category vs. one account.
export function unassignedCashCents(cashAccountsBalanceCents: number, totalCategoryBalanceCents: number): number {
  return cashAccountsBalanceCents - totalCategoryBalanceCents;
}

export function categoryStatus(balanceCents: number, assignedThisMonthCents: number): CategoryStatus {
  if (balanceCents < 0) return 'overspent';
  if (assignedThisMonthCents === 0) return 'unbudgeted';
  if (balanceCents === 0) return 'fully-spent';
  return 'funded';
}

export function categoryCaption(
  status: CategoryStatus,
  spentThisMonthCents: number,
  assignedThisMonthCents: number,
  balanceCents: number,
): string {
  switch (status) {
    case 'overspent':
      return `Overspent by ${formatMoney(-balanceCents)}`;
    case 'unbudgeted':
      return 'Not budgeted';
    case 'fully-spent':
      return `Fully spent ${formatMoney(spentThisMonthCents)}`;
    default:
      return spentThisMonthCents > 0
        ? `Spent ${formatMoney(spentThisMonthCents)} of ${formatMoney(assignedThisMonthCents)}`
        : 'Funded';
  }
}

export function accountBalanceCents(openingBalanceCents: number, transactionAmountsCents: number[]): number {
  return transactionAmountsCents.reduce((sum, amount) => sum + amount, openingBalanceCents);
}
