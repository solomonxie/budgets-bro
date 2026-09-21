import type { RatePoint } from './exchangeRates';

// Pure reading of a rate series — no fetching, no formatting. Everything the
// exchange page says about a pair beyond "today's number" comes from here.

export interface FxStats {
  latest: RatePoint | null;
  high: RatePoint | null;
  low: RatePoint | null;
  averageRate: number;
  /** Change from the first point in the window to the last, as a fraction. */
  changeFraction: number;
}

export function fxStats(points: RatePoint[]): FxStats {
  if (points.length === 0) {
    return { latest: null, high: null, low: null, averageRate: 0, changeFraction: 0 };
  }
  let high = points[0];
  let low = points[0];
  let sum = 0;
  for (const point of points) {
    if (point.rate > high.rate) high = point;
    if (point.rate < low.rate) low = point;
    sum += point.rate;
  }
  const first = points[0];
  const latest = points[points.length - 1];
  return {
    latest,
    high,
    low,
    averageRate: sum / points.length,
    changeFraction: first.rate === 0 ? 0 : (latest.rate - first.rate) / first.rate,
  };
}

/** The series from `days` ago to the end — the window a "1 year" chip means. */
export function sliceRecent(points: RatePoint[], days: number): RatePoint[] {
  if (points.length === 0) return [];
  const end = new Date(`${points[points.length - 1].date}T00:00:00Z`).getTime();
  const cutoff = end - days * 86_400_000;
  return points.filter((p) => new Date(`${p.date}T00:00:00Z`).getTime() >= cutoff);
}

// Five years of daily rates is roughly 1,300 points on a 350-point-wide
// chart: most of them would land on a pixel another one already owns. Taking
// every nth point keeps the shape and the extremes of the line while giving
// the scrub something it can actually land on.
export function downsample(points: RatePoint[], maxPoints: number): RatePoint[] {
  if (points.length <= maxPoints || maxPoints < 2) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: RatePoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.round(i * step)]);
  }
  return out;
}

/** Convert with the pair's rate, in whole cents of the target currency. */
export function convertCents(amountCents: number, rate: number): number {
  return Math.round(amountCents * rate);
}
