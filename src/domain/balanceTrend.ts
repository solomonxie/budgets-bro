import { currentMonth, monthsBetween } from './month';

export interface BalanceTrendPoint {
  month: string; // 'YYYY-MM'
  balanceCents: number; // balance as of month-end
  spendingCents: number; // this month's outflows, as a positive number
}

// Resamples a real ledger (ordinary transactions, no manual value-logging)
// onto a monthly calendar — a level (balance) and a flow (spending) sharing
// one x-axis, unlike ValueHistoryChart's manually-logged snapshots. Walks
// forward from the implied opening balance (endingBalanceCents minus every
// transaction's delta) so every month gets a real balance-after figure,
// including ones with no activity at all (it just carries forward).
export function monthlyBalanceTrend(
  transactions: { amountCents: number; date: string }[],
  endingBalanceCents: number,
): BalanceTrendPoint[] {
  if (transactions.length === 0) return [];
  const chronological = [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const totalDeltaCents = chronological.reduce((sum, t) => sum + t.amountCents, 0);
  const months = monthsBetween(chronological[0].date.slice(0, 7), currentMonth());

  let running = endingBalanceCents - totalDeltaCents;
  let txnIndex = 0;
  return months.map((month) => {
    let spendingCents = 0;
    while (txnIndex < chronological.length && chronological[txnIndex].date.slice(0, 7) <= month) {
      const amountCents = chronological[txnIndex].amountCents;
      running += amountCents;
      if (amountCents < 0) spendingCents += -amountCents;
      txnIndex++;
    }
    return { month, balanceCents: running, spendingCents };
  });
}
