// Interest a deposit account earned over [start, endExclusive), from its
// balance each day and whichever rate was in effect that day. Simple daily
// accrual — banks compound monthly at most, a rounding error at these rates.
export interface InterestEstimateInput {
  start: string;
  endExclusive: string;
  balanceBeforeCents: number;
  // Net movement per day inside the range, ascending.
  changes: { date: string; cents: number }[];
  // Every rate on file up to the range's end, ascending by date.
  rates: { date: string; bps: number }[];
}

const DAY_MS = 86_400_000;

function dayIndex(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

export function estimateInterestCents(input: InterestEstimateInput): number {
  const first = dayIndex(input.start);
  const last = dayIndex(input.endExclusive);
  let balance = input.balanceBeforeCents;
  let rateBps = 0;
  let c = 0;
  let r = 0;
  let total = 0;
  for (let day = first; day < last; day += 1) {
    while (r < input.rates.length && dayIndex(input.rates[r].date) <= day) {
      rateBps = input.rates[r].bps;
      r += 1;
    }
    while (c < input.changes.length && dayIndex(input.changes[c].date) <= day) {
      balance += input.changes[c].cents;
      c += 1;
    }
    if (balance > 0) total += (balance * rateBps) / 10000 / 365;
  }
  return Math.round(total);
}
