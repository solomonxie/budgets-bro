import { monthlyGrowthRate } from './monthlyGrowthRate';

describe('monthlyGrowthRate', () => {
  it('compounds from the month a year back', () => {
    const points = [
      { month: '2025-08', cents: 50_000 },
      { month: '2025-09', cents: 100_000 },
      { month: '2026-03', cents: 150_000 },
    ];
    const rate = monthlyGrowthRate(points, 112_683, '2026-09')!;
    expect(rate).toBeCloseTo(1, 1);
  });

  it('falls back to the oldest month on a young account', () => {
    const rate = monthlyGrowthRate(
      [{ month: '2026-07', cents: 100_000 }],
      121_000,
      '2026-09',
    )!;
    expect(rate).toBeCloseTo(10, 5);
  });

  it('is null with no earlier month or a non-positive end', () => {
    expect(
      monthlyGrowthRate([{ month: '2026-09', cents: 1 }], 5, '2026-09'),
    ).toBeNull();
    expect(
      monthlyGrowthRate([{ month: '2026-01', cents: 0 }], 5, '2026-09'),
    ).toBeNull();
  });
});
