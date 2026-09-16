import { monthlyPaymentCents } from './amortization';
import { biweeklyEquivalentMonthlyCents, buildScheduleWithExtras, comparePayoff } from './payoff';

describe('buildScheduleWithExtras', () => {
  it('matches the plain schedule when there are no extras', () => {
    const rows = buildScheduleWithExtras(120_000, 0, 10_000, '2026-01-01');
    expect(rows).toHaveLength(12);
    expect(rows.at(-1)?.balanceCents).toBe(0);
  });

  it('shortens the loan with a monthly extra', () => {
    const payment = monthlyPaymentCents(30_000_000, 600, 360);
    const base = buildScheduleWithExtras(30_000_000, 600, payment, '2026-01-01');
    const extra = buildScheduleWithExtras(30_000_000, 600, payment, '2026-01-01', { monthlyCents: 20_000 });
    expect(extra.length).toBeLessThan(base.length);
  });

  it('only starts a monthly extra once its start date is reached', () => {
    const early = buildScheduleWithExtras(120_000, 0, 10_000, '2026-01-01', { monthlyCents: 5_000 });
    const late = buildScheduleWithExtras(120_000, 0, 10_000, '2026-01-01', {
      monthlyCents: 5_000,
      monthlyStartDateIso: '2026-07-01',
    });
    expect(early.length).toBeLessThan(late.length);
    // First payment lands 2026-02-01, before the July start.
    expect(late[0].principalCents).toBe(10_000);
    expect(late.find((r) => r.date === '2026-07-01')?.principalCents).toBe(15_000);
  });

  it('applies a one-time extra exactly once, on the first period on or after its date', () => {
    const rows = buildScheduleWithExtras(120_000, 0, 10_000, '2026-01-01', {
      oneTimeCents: 30_000,
      oneTimeDateIso: '2026-04-01',
    });
    const boosted = rows.filter((r) => r.principalCents > 10_000);
    expect(boosted).toHaveLength(1);
    expect(boosted[0].date).toBe('2026-04-01');
    expect(boosted[0].principalCents).toBe(40_000);
  });

  it('repeats a yearly extra in the same month each year', () => {
    const rows = buildScheduleWithExtras(10_000_000, 0, 10_000, '2026-01-01', {
      yearlyCents: 100_000,
      yearlyStartDateIso: '2026-03-01',
    });
    const boosted = rows.filter((r) => r.principalCents > 10_000).map((r) => r.date);
    expect(boosted.slice(0, 3)).toEqual(['2026-03-01', '2027-03-01', '2028-03-01']);
  });

  it('caps the final payment at the remaining balance', () => {
    const rows = buildScheduleWithExtras(105_000, 0, 10_000, '2026-01-01');
    expect(rows.at(-1)?.principalCents).toBe(5_000);
    expect(rows.at(-1)?.balanceCents).toBe(0);
  });

  it('stops instead of looping when the payment never covers the interest', () => {
    expect(buildScheduleWithExtras(1_000_000, 2000, 100, '2026-01-01')).toEqual([]);
  });
});

describe('biweeklyEquivalentMonthlyCents', () => {
  it('is thirteen monthly payments spread over twelve months', () => {
    // 26 half-payments a year = 13 whole ones, not 12.
    expect(biweeklyEquivalentMonthlyCents(120_000)).toBe(130_000);
  });
});

describe('comparePayoff', () => {
  // calculator.net's mortgage payoff example: $230,000 left at 6% with a
  // $1,500 payment, plus $500/mo extra.
  const baseline = buildScheduleWithExtras(23_000_000, 600, 150_000, '2026-01-01');
  const accelerated = buildScheduleWithExtras(23_000_000, 600, 150_000, '2026-01-01', { monthlyCents: 50_000 });
  const result = comparePayoff(baseline, accelerated);

  it('reproduces the reference payoff terms', () => {
    expect(baseline).toHaveLength(292); // 24 yrs, 4 mos
    expect(accelerated).toHaveLength(172); // 14 yrs, 4 mos
    expect(result.monthsSaved).toBe(120);
  });

  it('reproduces the reference interest figures within a dollar', () => {
    // Reference: $207,677.36 / $113,122.63 / $94,554.73 saved.
    expect(result.baselineInterestCents).toBeCloseTo(20_767_736, -2);
    expect(result.acceleratedInterestCents).toBeCloseTo(11_312_263, -2);
    expect(result.interestSavedCents).toBeCloseTo(9_455_473, -2);
  });

  it('reproduces the reference percentages', () => {
    expect(Math.round(result.percentLessInterest)).toBe(46);
    expect(Math.round(result.percentFaster)).toBe(41);
  });

  it('reports no saving when nothing is accelerated', () => {
    const same = comparePayoff(baseline, baseline);
    expect(same.monthsSaved).toBe(0);
    expect(same.interestSavedCents).toBe(0);
    expect(same.percentLessInterest).toBe(0);
  });

  it('does not divide by zero on empty schedules', () => {
    expect(comparePayoff([], [])).toMatchObject({ percentLessInterest: 0, percentFaster: 0 });
  });
});
