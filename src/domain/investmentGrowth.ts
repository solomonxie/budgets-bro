// A tracking/investment account's history as a line: what has been paid in
// ("deposited", the net of real transactions posted to it) against what it
// is worth ("total"), with the difference falling out as "gain". Gains are
// derived, not stored — the same rule as account balances elsewhere in this
// app — so there is no new column to keep in sync; this reads the two
// tables that already exist (account_value_history, transactions) and lines
// them up by date.
//
// A point per event, valuation or transaction, because both move the line:
//
// - on a valuation, the account is worth exactly what was logged, and
//   whatever that is above the contributions is the gain;
// - on a transaction, it is worth the last valuation plus everything that
//   has moved since — the same rule the account's own balance follows (see
//   accountKind.toppedUpByContributions), so a statement logged in March
//   and a deposit in April read as the April total, not as March's figure
//   until someone gets round to logging again;
// - before the first valuation, the contributions are all there is to go
//   on and the gain is $0 rather than a guess.
//
// Keying only off valuations left an account with one logged statement and
// a year of contributions as a single point — one point is not a line, and
// the chart said there was not enough history to draw.

export interface GrowthPoint {
  date: string; // 'YYYY-MM-DD', one per event
  totalCents: number; // what the account is worth
  depositedCents: number; // every contribution paid in up to this date
  gainCents: number; // totalCents - depositedCents; negative on a loss
}

export function buildGrowthSeries(
  valueHistory: { valueCents: number; effectiveDate: string }[],
  transactions: { amountCents: number; date: string }[],
): GrowthPoint[] {
  const valueByDate = new Map<string, number>();
  for (const entry of [...valueHistory].sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : 1))) {
    valueByDate.set(entry.effectiveDate, entry.valueCents); // a later reading on the same day wins
  }
  // Two running totals per day: what was paid in, and the net movement.
  // "Deposited" is the money put in — contributions only — so a withdrawal
  // does not walk the line back down as if the contribution had never
  // happened, and a pair of rows that cancel out (a transfer recorded on
  // both sides of the same account) no longer flattens it. The net is what
  // actually moves the account's worth between valuations.
  const paidInByDate = new Map<string, number>();
  const netByDate = new Map<string, number>();
  for (const txn of transactions) {
    netByDate.set(txn.date, (netByDate.get(txn.date) ?? 0) + txn.amountCents);
    if (txn.amountCents > 0) {
      paidInByDate.set(txn.date, (paidInByDate.get(txn.date) ?? 0) + txn.amountCents);
    }
  }
  const dates = [...new Set([...valueByDate.keys(), ...netByDate.keys()])].sort();

  let depositedCents = 0;
  let totalCents = 0;
  // What the last valuation said the account was worth above its deposits —
  // carried across the contributions that follow it, since a deposit adds
  // to the total without changing the gain.
  let gainCents = 0;
  return dates.map((date) => {
    depositedCents += paidInByDate.get(date) ?? 0;
    totalCents += netByDate.get(date) ?? 0;
    const logged = valueByDate.get(date);
    if (logged != null) totalCents = logged;
    gainCents = totalCents - depositedCents;
    return { date, totalCents, depositedCents, gainCents };
  });
}

// Resamples a (sparse, irregularly-dated) growth series onto a fixed list
// of periods for charting — carries each period forward from the latest
// snapshot logged on or before it (a step function, since a logged value
// stays true until superseded), `null` for any period before the first
// snapshot exists. Periods are date-string prefixes, so the same sweep
// buckets by month ('YYYY-MM') or by year ('YYYY') with no other change.
// `series` must already be chronological (as `buildGrowthSeries` returns
// it) and `periods` ascending.
export function projectGrowthOntoPeriods(series: GrowthPoint[], periods: string[]): (GrowthPoint | null)[] {
  let seriesIndex = -1;
  return periods.map((period) => {
    while (seriesIndex + 1 < series.length && series[seriesIndex + 1].date.slice(0, period.length) <= period) seriesIndex++;
    return seriesIndex >= 0 ? series[seriesIndex] : null;
  });
}
