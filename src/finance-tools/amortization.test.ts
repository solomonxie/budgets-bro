import {
  addMonths,
  buildAmortizationSchedule,
  monthlyPaymentCents,
  remainingMonthsToPayoff,
  totalInterestRemainingCents,
} from './amortization';

describe('monthlyPaymentCents', () => {
  it('matches the standard formula for a 30yr fixed at 6%', () => {
    // $300,000 at 6%/yr over 360 months ≈ $1798.65/mo
    expect(monthlyPaymentCents(30_000_000, 600, 360)).toBe(179865);
  });

  it('divides evenly at 0% interest', () => {
    expect(monthlyPaymentCents(120_000, 0, 12)).toBe(10_000);
  });
});

describe('remainingMonthsToPayoff', () => {
  it('returns 0 for an already-paid-off balance', () => {
    expect(remainingMonthsToPayoff(0, 500, 100_000)).toBe(0);
  });

  it('returns Infinity when the payment does not cover accruing interest', () => {
    expect(remainingMonthsToPayoff(1_000_000, 2000, 100)).toBe(Infinity);
  });

  it('round-trips with monthlyPaymentCents for a full term', () => {
    const principal = 30_000_000;
    const rate = 600;
    const term = 360;
    // Rounding the payment to whole cents means the payoff month can land
    // a hair off the nominal term — allow ±1 month.
    const payment = monthlyPaymentCents(principal, rate, term);
    expect(remainingMonthsToPayoff(principal, rate, payment)).toBeLessThanOrEqual(term + 1);
    expect(remainingMonthsToPayoff(principal, rate, payment)).toBeGreaterThan(term - 2);
  });

  it('an extra payment on top of the scheduled amount shortens the payoff', () => {
    const principal = 30_000_000;
    const rate = 600;
    const scheduled = monthlyPaymentCents(principal, rate, 360);
    const withExtra = remainingMonthsToPayoff(principal, rate, scheduled + 20_000);
    expect(withExtra).toBeLessThan(remainingMonthsToPayoff(principal, rate, scheduled));
  });
});

describe('totalInterestRemainingCents', () => {
  it('is the payment stream minus principal', () => {
    expect(totalInterestRemainingCents(100_000, 10_000, 12)).toBe(20_000);
  });

  it('propagates Infinity', () => {
    expect(totalInterestRemainingCents(100_000, 10_000, Infinity)).toBe(Infinity);
  });
});

describe('buildAmortizationSchedule', () => {
  it('splits an even, zero-interest loan into equal principal rows down to zero', () => {
    const rows = buildAmortizationSchedule(120_000, 0, 10_000, '2026-01-01');
    expect(rows).toHaveLength(12);
    expect(rows.every((row) => row.interestCents === 0 && row.principalCents === 10_000)).toBe(true);
    expect(rows[11].balanceCents).toBe(0);
    expect(rows[0].date).toBe('2026-02-01');
  });

  it('matches the term length (±1) for a standard fixed-rate payment', () => {
    const principal = 30_000_000;
    const rate = 600;
    const term = 360;
    const payment = monthlyPaymentCents(principal, rate, term);
    const rows = buildAmortizationSchedule(principal, rate, payment, '2026-01-01');
    expect(rows.length).toBeLessThanOrEqual(term + 1);
    expect(rows.length).toBeGreaterThan(term - 2);
    expect(rows.at(-1)?.balanceCents).toBe(0);
    // principal + interest should sum back to (about) the original balance + total interest
    const totalPrincipal = rows.reduce((sum, row) => sum + row.principalCents, 0);
    expect(totalPrincipal).toBe(principal);
  });

  it('an extra payment shortens the schedule', () => {
    const principal = 30_000_000;
    const rate = 600;
    const payment = monthlyPaymentCents(principal, rate, 360);
    const withExtra = buildAmortizationSchedule(principal, rate, payment + 20_000, '2026-01-01');
    const withoutExtra = buildAmortizationSchedule(principal, rate, payment, '2026-01-01');
    expect(withExtra.length).toBeLessThan(withoutExtra.length);
  });

  it('stops instead of looping forever when the payment does not cover interest', () => {
    expect(buildAmortizationSchedule(1_000_000, 2000, 100, '2026-01-01')).toEqual([]);
  });
});

describe('addMonths', () => {
  it('advances within a year', () => {
    expect(addMonths('2026-01-15', 3)).toBe('2026-04-15');
  });

  it('rolls into the next year', () => {
    expect(addMonths('2026-11-01', 3)).toBe('2027-02-01');
  });
});
