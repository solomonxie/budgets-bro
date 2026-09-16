import { buildEqualPrincipalSchedule, equalPrincipalMonthlyDecrementCents } from './equalPrincipal';

describe('buildEqualPrincipalSchedule', () => {
  // 100万元 at 3.5% over 30 years — an ordinary Chinese mortgage.
  const rows = buildEqualPrincipalSchedule(100_000_000, 350, 360, '2026-01-01');

  it('runs for exactly the contracted term', () => {
    expect(rows).toHaveLength(360);
    expect(rows[0].date).toBe('2026-02-01');
  });

  it('repays the principal exactly, ending on a zero balance', () => {
    expect(rows.reduce((sum, row) => sum + row.principalCents, 0)).toBe(100_000_000);
    expect(rows.at(-1)?.balanceCents).toBe(0);
  });

  it('pays the same principal every month bar the last', () => {
    const perPeriod = Math.floor(100_000_000 / 360);
    expect(rows.slice(0, -1).every((row) => row.principalCents === perPeriod)).toBe(true);
    // The remainder lands on the final period rather than being lost.
    expect(rows.at(-1)!.principalCents).toBeGreaterThanOrEqual(perPeriod);
  });

  it('shrinks the payment by the nominal decrement each month, give or take a rounding cent', () => {
    // Rounding each period's interest to whole fen makes the real step
    // alternate by a cent — the quoted 每月递减 is the nominal figure.
    const decrement = equalPrincipalMonthlyDecrementCents(100_000_000, 350, 360);
    for (const i of [0, 100, 250]) {
      expect(Math.abs(rows[i].paymentCents - rows[i + 1].paymentCents - decrement)).toBeLessThanOrEqual(1);
    }
  });

  it('falls strictly month over month', () => {
    expect(rows.slice(0, -1).every((row, i) => row.paymentCents > rows[i + 1].paymentCents)).toBe(true);
  });

  it('costs less interest overall than the level-payment method', () => {
    // The whole reason 等额本金 is recommended to anyone planning to prepay.
    const equalPrincipalInterest = rows.reduce((sum, row) => sum + row.interestCents, 0);
    expect(equalPrincipalInterest).toBeLessThan(60_000_000);
    expect(equalPrincipalInterest).toBeGreaterThan(50_000_000);
  });

  it('charges no interest at 0%', () => {
    const free = buildEqualPrincipalSchedule(120_000, 0, 12, '2026-01-01');
    expect(free.every((row) => row.interestCents === 0)).toBe(true);
    expect(free.every((row) => row.principalCents === 10_000)).toBe(true);
  });

  it('returns nothing for a degenerate loan', () => {
    expect(buildEqualPrincipalSchedule(0, 350, 360, '2026-01-01')).toEqual([]);
    expect(buildEqualPrincipalSchedule(100_000, 350, 0, '2026-01-01')).toEqual([]);
  });
});

describe('equalPrincipalMonthlyDecrementCents', () => {
  it('is the monthly principal slice times the monthly rate', () => {
    // 1,200,000 / 12 = 100,000 principal a month; 12%/yr = 1%/mo.
    expect(equalPrincipalMonthlyDecrementCents(1_200_000, 1200, 12)).toBe(1_000);
  });

  it('is zero on a degenerate loan', () => {
    expect(equalPrincipalMonthlyDecrementCents(0, 350, 360)).toBe(0);
  });
});
