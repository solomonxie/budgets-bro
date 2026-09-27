import { paycheckToPaycheckCount, rollingAverageMonths, runwayLevel, runwayTrend } from './runway';

describe('runwayLevel', () => {
  it('bands at 1 / 3 / 6 months', () => {
    expect(runwayLevel(0.5)).toBe('paycheck');
    expect(runwayLevel(1)).toBe('thin');
    expect(runwayLevel(3)).toBe('covered');
    expect(runwayLevel(6)).toBe('strong');
  });
});

describe('runwayTrend', () => {
  it('divides cash at month end by the average monthly cost so far', () => {
    const points = runwayTrend({
      months: ['2026-01', '2026-02'],
      openingCents: 100_000,
      activity: [
        { month: '2026-01', netCents: 200_000, costCents: 100_000 },
        { month: '2026-02', netCents: 100_000, costCents: 300_000 },
      ],
      currentMonth: '2026-06',
    });
    expect(points[0]).toEqual({ month: '2026-01', cashCents: 300_000, avgCostCents: 100_000, months: 3 });
    expect(points[1].cashCents).toBe(400_000);
    expect(points[1].avgCostCents).toBe(200_000);
    expect(points[1].months).toBe(2);
  });

  it('counts a quiet month as zero cost and carries cash forward', () => {
    const points = runwayTrend({
      months: ['2026-01', '2026-02'],
      openingCents: 0,
      activity: [{ month: '2026-01', netCents: 400_000, costCents: 200_000 }],
      currentMonth: '2026-06',
    });
    expect(points[1].cashCents).toBe(400_000);
    expect(points[1].avgCostCents).toBe(100_000);
    expect(points[1].months).toBe(4);
  });

  it('leaves the half-finished current month out of its own average', () => {
    const points = runwayTrend({
      months: ['2026-05', '2026-06'],
      openingCents: 0,
      activity: [
        { month: '2026-05', netCents: 300_000, costCents: 100_000 },
        { month: '2026-06', netCents: 0, costCents: 10_000 },
      ],
      currentMonth: '2026-06',
    });
    expect(points[1].avgCostCents).toBe(100_000);
    expect(points[1].months).toBe(3);
  });

  it('averages only the trailing 12 months', () => {
    const months = Array.from({ length: 13 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`).map((m, i) =>
      i === 12 ? '2026-01' : m,
    );
    const activity = months.map((month, i) => ({ month, netCents: 0, costCents: i === 0 ? 1_200_000 : 100_000 }));
    const last = runwayTrend({ months, openingCents: 0, activity, currentMonth: '2027-01' }).at(-1)!;
    expect(last.avgCostCents).toBe(100_000);
  });

  it('has no answer before anything was spent, and never goes below zero', () => {
    const points = runwayTrend({
      months: ['2026-01', '2026-02'],
      openingCents: 0,
      activity: [
        { month: '2026-01', netCents: 50_000, costCents: 0 },
        { month: '2026-02', netCents: -150_000, costCents: 150_000 },
      ],
      currentMonth: '2026-06',
    });
    expect(points[0].months).toBeNull();
    expect(points[1].months).toBe(0);
  });
});

describe('paycheckToPaycheckCount', () => {
  it('counts months under one month of runway', () => {
    const p = (months: number | null) => ({ month: '', cashCents: 0, avgCostCents: 0, months });
    expect(paycheckToPaycheckCount([p(0.5), p(2), p(null), p(0.9)])).toBe(2);
  });
});

describe('rollingAverageMonths', () => {
  const p = (months: number | null) => ({ month: '', cashCents: 0, avgCostCents: 0, months });
  it('averages each month with the ones before it, skipping gaps', () => {
    expect(rollingAverageMonths([p(null), p(2), p(4), p(6)])).toEqual([null, 2, 3, 4]);
  });
  it('drops months older than the window', () => {
    expect(rollingAverageMonths([p(10), p(2), p(4)], 2)).toEqual([10, 6, 3]);
  });
});
