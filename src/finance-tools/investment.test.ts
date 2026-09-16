import {
  buildAccumulationSchedule,
  effectiveAnnualRate,
  futureValueCents,
  solveAnnualReturnBps,
  solveContributionCents,
  solveStartingCents,
  solveYears,
} from './investment';
import type { InvestmentInput } from './investment';

// calculator.net's investment example: $700,000 for 10 years at 6%,
// compounded annually, no additional contributions.
const REFERENCE: InvestmentInput = {
  startingCents: 70_000_000,
  years: 10,
  annualReturnBps: 600,
  compound: 'annually',
  contributionCents: 0,
  timing: 'beginningOfMonth',
};

describe('effectiveAnnualRate', () => {
  it('is the nominal rate when compounded annually', () => {
    expect(effectiveAnnualRate(600, 'annually')).toBeCloseTo(0.06, 10);
  });

  it('exceeds the nominal rate as compounding gets more frequent', () => {
    expect(effectiveAnnualRate(600, 'monthly')).toBeGreaterThan(effectiveAnnualRate(600, 'quarterly'));
    expect(effectiveAnnualRate(600, 'quarterly')).toBeGreaterThan(effectiveAnnualRate(600, 'annually'));
    expect(effectiveAnnualRate(600, 'continuously')).toBeGreaterThan(effectiveAnnualRate(600, 'daily'));
  });
});

describe('futureValueCents', () => {
  it('reproduces the reference end balance and interest', () => {
    const result = futureValueCents(REFERENCE);
    expect(result.endBalanceCents).toBe(125_359_339); // $1,253,593.39
    expect(result.totalContributionsCents).toBe(0);
    expect(result.totalInterestCents).toBe(55_359_339); // $553,593.39
  });

  it('grows more with contributions at the start of each period than at the end', () => {
    const start = futureValueCents({ ...REFERENCE, contributionCents: 50_000, timing: 'beginningOfMonth' });
    const end = futureValueCents({ ...REFERENCE, contributionCents: 50_000, timing: 'endOfMonth' });
    expect(start.endBalanceCents).toBeGreaterThan(end.endBalanceCents);
  });

  it('counts every contribution exactly once', () => {
    const result = futureValueCents({ ...REFERENCE, contributionCents: 50_000, timing: 'endOfMonth' });
    expect(result.totalContributionsCents).toBe(50_000 * 12 * 10);
  });

  it('returns the starting amount untouched over zero years', () => {
    const result = futureValueCents({ ...REFERENCE, years: 0 });
    expect(result.endBalanceCents).toBe(REFERENCE.startingCents);
    expect(result.totalInterestCents).toBe(0);
  });

  it('earns nothing at a zero return', () => {
    const result = futureValueCents({ ...REFERENCE, annualReturnBps: 0, contributionCents: 10_000, timing: 'endOfYear' });
    expect(result.totalInterestCents).toBe(0);
    expect(result.endBalanceCents).toBe(REFERENCE.startingCents + 10_000 * 10);
  });
});

describe('buildAccumulationSchedule', () => {
  const rows = buildAccumulationSchedule(REFERENCE);

  it('has one row per year', () => {
    expect(rows).toHaveLength(10);
    expect(rows[0].year).toBe(1);
  });

  it('reproduces the reference first and last years', () => {
    expect(rows[0]).toMatchObject({ startBalanceCents: 70_000_000, interestCents: 4_200_000, endBalanceCents: 74_200_000 });
    expect(rows[9].endBalanceCents).toBe(125_359_339);
  });

  it('chains each year onto the previous one', () => {
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].startBalanceCents).toBe(rows[i - 1].endBalanceCents);
    }
  });

  it('accounts for every cent within each year', () => {
    for (const row of rows) {
      expect(row.startBalanceCents + row.contributionCents + row.interestCents).toBe(row.endBalanceCents);
    }
  });
});

describe('solvers', () => {
  const withContributions: InvestmentInput = { ...REFERENCE, contributionCents: 50_000, timing: 'endOfMonth' };
  const target = futureValueCents(withContributions).endBalanceCents;

  it('recovers the starting amount', () => {
    expect(solveStartingCents(target, withContributions)).toBeCloseTo(withContributions.startingCents, -3);
  });

  it('recovers the contribution', () => {
    expect(solveContributionCents(target, withContributions)).toBeCloseTo(withContributions.contributionCents, -2);
  });

  it('recovers the return rate', () => {
    expect(solveAnnualReturnBps(target, withContributions)).toBeCloseTo(600, 0);
  });

  it('recovers the number of years', () => {
    expect(solveYears(target, withContributions)).toBeCloseTo(10, 1);
  });

  it('answers zero years for a target already met', () => {
    expect(solveYears(REFERENCE.startingCents, { ...REFERENCE, contributionCents: 0 })).toBeCloseTo(0, 2);
  });
});
