import { formatMoney } from './money';

export type CategoryStatus = 'overspent' | 'fully-spent' | 'funded' | 'unbudgeted';

// Cumulative, not per-month: an unspent balance rolls forward automatically
// because this is a running sum, not a reset-each-month calculation.
export function categoryBalanceCents(cumulativeAssignedCents: number, cumulativeActivityCents: number): number {
  return cumulativeAssignedCents + cumulativeActivityCents;
}

// `totalUncategorizedCents` is a signed sum (uncategorized, non-transfer
// transactions) — not just positive inflows, so a negative balance
// correction correctly reduces this instead of being ignored.
export function unassignedCashCents(totalUncategorizedCents: number, totalAssignedCents: number): number {
  return totalUncategorizedCents - totalAssignedCents;
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
      return 'Fully spent';
    default:
      return spentThisMonthCents > 0
        ? `Spent ${formatMoney(spentThisMonthCents)} of ${formatMoney(assignedThisMonthCents)}`
        : 'Funded';
  }
}

export function accountBalanceCents(openingBalanceCents: number, transactionAmountsCents: number[]): number {
  return transactionAmountsCents.reduce((sum, amount) => sum + amount, openingBalanceCents);
}
