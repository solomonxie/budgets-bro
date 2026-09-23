import { payeeMonthOverAverage, summarizePayees } from './payeeInsights';
import type { PayeeTrendPoint } from '../db/repositories/reportsRepo';

const months = ['2026-07', '2026-08', '2026-09'];

const point = (
  payeeId: number | null,
  name: string | null,
  month: string,
  spentCents: number,
  count = 1,
): PayeeTrendPoint => ({ payeeId, name, month, spentCents, count });

describe('summarizePayees', () => {
  it('ranks by total spent and fills every month of the window', () => {
    const { payees } = summarizePayees(
      [
        point(1, 'Corner Shop', '2026-07', 2000, 4),
        point(1, 'Corner Shop', '2026-09', 3000, 6),
        point(2, 'Landlord', '2026-08', 120000),
      ],
      months,
    );

    expect(payees.map((p) => p.name)).toEqual(['Landlord', 'Corner Shop']);
    expect(payees[1]).toMatchObject({
      totalCents: 5000,
      count: 10,
      avgCents: 500,
      monthsPaid: 2,
      lastMonth: '2026-09',
    });
    expect(payees[1].series).toEqual([
      { month: '2026-07', spentCents: 2000 },
      { month: '2026-08', spentCents: 0 },
      { month: '2026-09', spentCents: 3000 },
    ]);
  });

  it('spreads the total over the whole window, not just the months paid', () => {
    const { payees } = summarizePayees(
      [point(1, 'Insurer', '2026-08', 30000)],
      months,
    );
    expect(payees[0].perMonthCents).toBe(10000);
  });

  it('keeps unnamed spending out of the ranking but counts it', () => {
    const { payees, unnamedCents, totalCents } = summarizePayees(
      [
        point(1, 'Corner Shop', '2026-09', 2000),
        point(null, null, '2026-09', 500),
      ],
      months,
    );
    expect(payees).toHaveLength(1);
    expect(unnamedCents).toBe(500);
    expect(totalCents).toBe(2500);
  });

  it('ignores points outside the window', () => {
    const { payees, totalCents } = summarizePayees(
      [
        point(1, 'Corner Shop', '2026-09', 2000),
        point(1, 'Corner Shop', '2025-01', 9900),
      ],
      months,
    );
    expect(totalCents).toBe(2000);
    expect(payees[0].series).toHaveLength(3);
  });
});

describe('payeeMonthOverAverage', () => {
  const summarize = (points: PayeeTrendPoint[]) =>
    summarizePayees(points, months).payees[0];

  it('compares the last month with the average of the ones before it', () => {
    const summary = summarize([
      point(1, 'Corner Shop', '2026-07', 1000),
      point(1, 'Corner Shop', '2026-08', 3000),
      point(1, 'Corner Shop', '2026-09', 4000),
    ]);
    expect(payeeMonthOverAverage(summary)).toBe(100);
  });

  it('has no direction to report when nothing came before', () => {
    const summary = summarize([point(1, 'Corner Shop', '2026-09', 4000)]);
    expect(payeeMonthOverAverage(summary)).toBeNull();
  });
});
