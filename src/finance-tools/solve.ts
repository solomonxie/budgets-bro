// Bisection root-finder. Two of the calculators are circular and have no
// closed form: max affordable house price (property tax and insurance are a
// percentage of the price you're solving for) and the investment return rate
// needed to hit a target. Both are monotonic in the unknown, so bisection is
// enough and can't diverge the way Newton can on a flat segment.

// `f` must be monotonic over [lo, hi]. When the interval doesn't bracket a
// root the answer is the closer bound rather than a throw — a calculator
// screen wants a sane clamped number while the user is still typing, not an
// exception on every keystroke.
export function bisect(f: (x: number) => number, lo: number, hi: number, tolerance = 1e-6, maxIterations = 200): number {
  let low = lo;
  let high = hi;
  let fLow = f(low);
  const fHigh = f(high);
  if (!Number.isFinite(fLow) || !Number.isFinite(fHigh)) return low;
  if (fLow === 0) return low;
  if (fHigh === 0) return high;
  if (fLow > 0 === fHigh > 0) return Math.abs(fLow) <= Math.abs(fHigh) ? low : high;

  for (let i = 0; i < maxIterations && high - low > tolerance; i += 1) {
    const mid = (low + high) / 2;
    const fMid = f(mid);
    if (fMid === 0) return mid;
    if (fMid > 0 === fLow > 0) {
      low = mid;
      fLow = fMid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}
