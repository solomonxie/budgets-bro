import { bisect } from './solve';

describe('bisect', () => {
  it('finds the root of a monotonic function', () => {
    expect(bisect((x) => x * x - 4, 0, 10)).toBeCloseTo(2, 5);
  });

  it('honours the tolerance', () => {
    const root = bisect((x) => x - 1 / 3, 0, 1, 1e-9);
    expect(Math.abs(root - 1 / 3)).toBeLessThan(1e-9);
  });

  it('returns an exact bound when the root sits on it', () => {
    expect(bisect((x) => x - 5, 5, 10)).toBe(5);
    expect(bisect((x) => x - 10, 5, 10)).toBe(10);
  });

  it('returns the closer bound instead of looping when the root is not bracketed', () => {
    // Both ends positive — no sign change, so there is nothing to bisect.
    expect(bisect((x) => x + 1, 0, 10)).toBe(0);
    expect(bisect((x) => -x - 1, 0, 10)).toBe(0);
  });

  it('falls back to the low bound on a non-finite evaluation', () => {
    expect(bisect(() => NaN, 2, 8)).toBe(2);
  });
});
