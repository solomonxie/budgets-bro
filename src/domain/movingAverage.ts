// Each point's average over the calendar months ending with its own — the
// moving benchmark line every trend chart draws. `date` is 'YYYY-MM' or
// 'YYYY-MM-DD', oldest first; null values are skipped. `includeSelf: false`
// compares a point with its past only, never itself.
export const AVERAGE_WINDOW_MONTHS = 12;

const monthIndex = (date: string) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

export function trailingAverages(
  points: { date: string; value: number | null }[],
  { months = AVERAGE_WINDOW_MONTHS, includeSelf = true } = {},
): (number | null)[] {
  const sums = [0];
  const counts = [0];
  for (const p of points) {
    sums.push(sums[sums.length - 1] + (p.value ?? 0));
    counts.push(counts[counts.length - 1] + (p.value == null ? 0 : 1));
  }
  let start = 0;
  return points.map((p, i) => {
    const from = monthIndex(p.date) - months + 1;
    while (monthIndex(points[start].date) < from) start++;
    const end = includeSelf ? i + 1 : i;
    const n = counts[end] - counts[start];
    return n > 0 ? (sums[end] - sums[start]) / n : null;
  });
}
