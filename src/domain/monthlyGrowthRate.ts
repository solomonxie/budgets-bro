import { currentMonth } from './month';

const WINDOW_MONTHS = 12;

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

// Compounded average growth per month, from the balance a year back (or the
// oldest one there is) to now. Null when there is no earlier month to start
// from, or either end isn't positive — a rate off zero or a debt says nothing.
export function monthlyGrowthRate(
  points: { month: string; cents: number }[],
  nowCents: number,
  now: string = currentMonth(),
): number | null {
  const nowIndex = monthIndex(now);
  const earlier = points.filter((p) => monthIndex(p.month) < nowIndex);
  if (earlier.length === 0) return null;
  const inWindow = earlier.filter(
    (p) => monthIndex(p.month) <= nowIndex - WINDOW_MONTHS,
  );
  const base = inWindow.at(-1) ?? earlier[0];
  const months = nowIndex - monthIndex(base.month);
  if (base.cents <= 0 || nowCents <= 0) return null;
  return ((nowCents / base.cents) ** (1 / months) - 1) * 100;
}
