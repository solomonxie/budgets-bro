import { buildGrowthSeries, projectGrowthOntoMonths } from './investmentGrowth';

describe('buildGrowthSeries', () => {
  it('attributes a snapshot with no deposits yet entirely to gain', () => {
    const series = buildGrowthSeries([{ valueCents: 10_000, effectiveDate: '2026-01-01' }], []);
    expect(series).toEqual([{ date: '2026-01-01', totalCents: 10_000, depositedCents: 0, gainCents: 10_000 }]);
  });

  it('nets deposits up to each snapshot date, leaving the remainder as gain', () => {
    const valueHistory = [
      { valueCents: 100_000, effectiveDate: '2026-01-01' },
      { valueCents: 220_000, effectiveDate: '2026-02-01' },
    ];
    const transactions = [
      { amountCents: 100_000, date: '2026-01-01' },
      { amountCents: 100_000, date: '2026-01-15' },
    ];
    const series = buildGrowthSeries(valueHistory, transactions);
    expect(series[0]).toEqual({ date: '2026-01-01', totalCents: 100_000, depositedCents: 100_000, gainCents: 0 });
    expect(series[1]).toEqual({ date: '2026-02-01', totalCents: 220_000, depositedCents: 200_000, gainCents: 20_000 });
  });

  it('a withdrawal reduces net deposits, so a flat value shows as a gain', () => {
    const valueHistory = [
      { valueCents: 100_000, effectiveDate: '2026-01-01' },
      { valueCents: 100_000, effectiveDate: '2026-02-01' },
    ];
    const transactions = [
      { amountCents: 100_000, date: '2026-01-01' },
      { amountCents: -20_000, date: '2026-01-20' },
    ];
    const series = buildGrowthSeries(valueHistory, transactions);
    expect(series[1]).toEqual({ date: '2026-02-01', totalCents: 100_000, depositedCents: 80_000, gainCents: 20_000 });
  });

  it('ignores transactions dated after the latest snapshot', () => {
    const series = buildGrowthSeries(
      [{ valueCents: 50_000, effectiveDate: '2026-01-01' }],
      [{ amountCents: 10_000, date: '2026-01-02' }],
    );
    expect(series[0].depositedCents).toBe(0);
  });

  it('sorts out-of-order input by date before pairing', () => {
    const series = buildGrowthSeries(
      [
        { valueCents: 220_000, effectiveDate: '2026-02-01' },
        { valueCents: 100_000, effectiveDate: '2026-01-01' },
      ],
      [
        { amountCents: 100_000, date: '2026-01-15' },
        { amountCents: 100_000, date: '2026-01-01' },
      ],
    );
    expect(series.map((p) => p.date)).toEqual(['2026-01-01', '2026-02-01']);
    expect(series[0].depositedCents).toBe(100_000);
    expect(series[1].depositedCents).toBe(200_000);
  });

  it('with no logged value yet, treats every transaction as a deposit with $0 gain', () => {
    const series = buildGrowthSeries(
      [],
      [
        { amountCents: 10_000, date: '2026-01-01' },
        { amountCents: 5_000, date: '2026-02-01' },
      ],
    );
    expect(series).toEqual([
      { date: '2026-01-01', totalCents: 10_000, depositedCents: 10_000, gainCents: 0 },
      { date: '2026-02-01', totalCents: 15_000, depositedCents: 15_000, gainCents: 0 },
    ]);
  });

  it('collapses same-day transactions into one implied point when there is no real log', () => {
    const series = buildGrowthSeries(
      [],
      [
        { amountCents: 10_000, date: '2026-01-01' },
        { amountCents: -2_000, date: '2026-01-01' },
        { amountCents: 5_000, date: '2026-02-01' },
      ],
    );
    expect(series).toEqual([
      { date: '2026-01-01', totalCents: 8_000, depositedCents: 8_000, gainCents: 0 },
      { date: '2026-02-01', totalCents: 13_000, depositedCents: 13_000, gainCents: 0 },
    ]);
  });

  it('stops using the fallback as soon as a real value is logged', () => {
    const series = buildGrowthSeries([{ valueCents: 12_000, effectiveDate: '2026-01-10' }], [{ amountCents: 10_000, date: '2026-01-01' }]);
    expect(series).toEqual([{ date: '2026-01-10', totalCents: 12_000, depositedCents: 10_000, gainCents: 2_000 }]);
  });
});

describe('projectGrowthOntoMonths', () => {
  it('returns null for months before the first snapshot', () => {
    const series = buildGrowthSeries([{ valueCents: 10_000, effectiveDate: '2026-03-01' }], []);
    const projected = projectGrowthOntoMonths(series, ['2026-01', '2026-02', '2026-03']);
    expect(projected).toEqual([null, null, series[0]]);
  });

  it('carries a snapshot forward until a later one supersedes it', () => {
    const series = buildGrowthSeries(
      [
        { valueCents: 10_000, effectiveDate: '2026-01-15' },
        { valueCents: 12_000, effectiveDate: '2026-03-10' },
      ],
      [],
    );
    const projected = projectGrowthOntoMonths(series, ['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(projected.map((p) => p?.totalCents ?? null)).toEqual([10_000, 10_000, 12_000, 12_000]);
  });
});
