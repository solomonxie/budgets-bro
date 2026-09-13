// Splits a tracking/investment account's manually-logged value history into
// "deposited" (net of real transactions/transfers posted to the account —
// contributions minus withdrawals) vs. "gain" (whatever's left once
// deposits are subtracted from the logged total) for each snapshot date.
// Gains are derived, not stored — same rule as account balances elsewhere
// in this app — so there's no new column/mode to keep in sync; this just
// reads the two tables that already exist (account_value_history,
// transactions) and lines them up by date. Before the user has logged any
// real snapshot, every transaction is treated as a deposit on its own —
// see `impliedValueHistory` below — so there's always a "deposited" line
// to chart and gain defaults to $0 rather than showing nothing at all.

export interface GrowthPoint {
  date: string; // 'YYYY-MM-DD', one per value_history snapshot
  totalCents: number; // the logged value itself
  depositedCents: number; // cumulative transaction amount as of this date
  gainCents: number; // totalCents - depositedCents; negative on a loss
}

// Fallback "value history" for an account with no manual log entries yet:
// treat every transaction as if it had also declared a matching snapshot
// on its own date (value == cumulative deposits through that date), so
// gain reads as exactly $0 until a real log entry says otherwise. Collapses
// same-day transactions into one point so it lines back up with
// buildGrowthSeries's own same-day grouping (its date <= date sweep would
// otherwise double-count a later same-day point against an earlier one).
function impliedValueHistory(transactions: { amountCents: number; date: string }[]): { valueCents: number; effectiveDate: string }[] {
  const chronological = [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const points: { valueCents: number; effectiveDate: string }[] = [];
  let running = 0;
  for (const txn of chronological) {
    running += txn.amountCents;
    const last = points[points.length - 1];
    if (last && last.effectiveDate === txn.date) last.valueCents = running;
    else points.push({ valueCents: running, effectiveDate: txn.date });
  }
  return points;
}

export function buildGrowthSeries(
  valueHistory: { valueCents: number; effectiveDate: string }[],
  transactions: { amountCents: number; date: string }[],
): GrowthPoint[] {
  const effectiveHistory = valueHistory.length > 0 ? valueHistory : impliedValueHistory(transactions);
  const chronologicalValues = [...effectiveHistory].sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : 1));
  const chronologicalTxns = [...transactions].sort((a, b) => (a.date < b.date ? -1 : 1));

  let txnIndex = 0;
  let depositedCents = 0;
  return chronologicalValues.map((entry) => {
    while (txnIndex < chronologicalTxns.length && chronologicalTxns[txnIndex].date <= entry.effectiveDate) {
      depositedCents += chronologicalTxns[txnIndex].amountCents;
      txnIndex++;
    }
    return {
      date: entry.effectiveDate,
      totalCents: entry.valueCents,
      depositedCents,
      gainCents: entry.valueCents - depositedCents,
    };
  });
}

// Resamples a (sparse, irregularly-dated) growth series onto a fixed list
// of 'YYYY-MM' months for charting — carries each month forward from the
// latest snapshot logged on or before it (a step function, since a logged
// value stays true until superseded), `null` for any month before the
// first snapshot exists. `series` must already be chronological (as
// `buildGrowthSeries` returns it) and `months` ascending.
export function projectGrowthOntoMonths(series: GrowthPoint[], months: string[]): (GrowthPoint | null)[] {
  let seriesIndex = -1;
  return months.map((month) => {
    while (seriesIndex + 1 < series.length && series[seriesIndex + 1].date.slice(0, 7) <= month) seriesIndex++;
    return seriesIndex >= 0 ? series[seriesIndex] : null;
  });
}
