import type { PayeeTrendPoint } from '../db/repositories/reportsRepo';

// Who you actually pay, over a window of months. Pure — the DB read lives
// in hooks/usePayeeTrend, the same split trackedPrices.ts uses.
//
// A category says "groceries, $600". A payee says "that one shop, $380 of
// it, every month since March". That is the difference between a budget
// line and a habit, and it is the only view that names the other side of
// the transaction.

export interface PayeeMonth {
  month: string;
  spentCents: number;
}

export interface PayeeSummary {
  payeeId: number;
  name: string;
  totalCents: number;
  count: number;
  // Per transaction, not per month — "what a visit costs".
  avgCents: number;
  // Spread over the whole window, including the months you paid them
  // nothing: a quarterly bill and a weekly shop that cost the same over a
  // year are not the same commitment.
  perMonthCents: number;
  monthsPaid: number;
  lastMonth: string;
  // One entry per month of the window, zeros filled, oldest first — the
  // trend chart plots this directly.
  series: PayeeMonth[];
}

export interface PayeeTrend {
  payees: PayeeSummary[];
  // Spending that named nobody. Reported, never ranked: a blank is not
  // somebody you pay, and the number is only here to say how much of the
  // page is missing.
  unnamedCents: number;
  totalCents: number;
}

// Biggest spend first — the question this page answers is "who gets my
// money?". Ties go to the more frequent payee, which is the more habitual
// one.
export function summarizePayees(
  points: PayeeTrendPoint[],
  months: string[],
): PayeeTrend {
  const byPayee = new Map<number, PayeeTrendPoint[]>();
  let unnamedCents = 0;
  let totalCents = 0;

  for (const point of points) {
    if (!months.includes(point.month)) continue;
    totalCents += point.spentCents;
    if (point.payeeId == null || point.name == null) {
      unnamedCents += point.spentCents;
      continue;
    }
    const group = byPayee.get(point.payeeId);
    if (group) group.push(point);
    else byPayee.set(point.payeeId, [point]);
  }

  const payees: PayeeSummary[] = [];
  for (const [payeeId, group] of byPayee) {
    const spentByMonth = new Map(group.map((p) => [p.month, p.spentCents]));
    const payeeTotal = group.reduce((sum, p) => sum + p.spentCents, 0);
    const count = group.reduce((sum, p) => sum + p.count, 0);
    payees.push({
      payeeId,
      name: group[0].name as string,
      totalCents: payeeTotal,
      count,
      avgCents: count > 0 ? Math.round(payeeTotal / count) : 0,
      perMonthCents: Math.round(payeeTotal / months.length),
      monthsPaid: group.length,
      lastMonth: group.reduce(
        (latest, p) => (p.month > latest ? p.month : latest),
        group[0].month,
      ),
      series: trimBeforeFirstPayment(
        months.map((month) => ({
          month,
          spentCents: spentByMonth.get(month) ?? 0,
        })),
      ),
    });
  }

  payees.sort((a, b) => b.totalCents - a.totalCents || b.count - a.count);
  return { payees, unnamedCents, totalCents };
}

// A payee didn't exist before its own first payment — a graph zero-filled
// back to the board's earliest month, or the window's first month, is mostly
// bars saying so and nothing else.
function trimBeforeFirstPayment(series: PayeeMonth[]): PayeeMonth[] {
  const firstPaid = series.findIndex((m) => m.spentCents > 0);
  return firstPaid <= 0 ? series : series.slice(firstPaid);
}

// A payee's last month against its own average over the months before it,
// as a percentage. Null when there is no "before" to compare with — one
// month of history is a number, not a direction.
export function payeeMonthOverAverage(summary: PayeeSummary): number | null {
  const { series } = summary;
  if (series.length < 2) return null;
  const prior = series.slice(0, -1);
  const priorAverage =
    prior.reduce((sum, m) => sum + m.spentCents, 0) / prior.length;
  if (priorAverage === 0) return null;
  const latest = series[series.length - 1].spentCents;
  return Math.round(((latest - priorAverage) / priorAverage) * 100);
}
