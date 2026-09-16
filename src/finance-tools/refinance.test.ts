import { compareRefinance, payoffMonthsAtCurrentPayment } from './refinance';
import { monthlyPaymentCents } from './amortization';

// calculator.net's refinance example: $250,000 left on a 6.5% loan with 25
// years to run, refinanced to 5.5% over 30 years, $4,000 in closing costs.
const REFERENCE = {
  balanceCents: 25_000_000,
  currentRateBps: 650,
  currentRemainingMonths: 300,
  newRateBps: 550,
  newTermMonths: 360,
  closingCostsCents: 400_000,
  rollCostsIntoLoan: false,
};

describe('compareRefinance', () => {
  const result = compareRefinance(REFERENCE);

  it('reproduces both payments', () => {
    expect(result.currentPaymentCents).toBeCloseTo(168_776, -2);
    expect(result.newPaymentCents).toBeCloseTo(141_940, -2);
  });

  it('breaks even once the monthly saving covers what was paid at closing', () => {
    expect(result.monthlySavingCents).toBeCloseTo(26_836, -2);
    expect(result.breakEvenMonths).toBe(Math.ceil(400_000 / result.monthlySavingCents));
  });

  it('charges the closing costs against the lifetime interest saved', () => {
    expect(result.lifetimeInterestSavedCents).toBe(
      result.currentTotalInterestCents - result.newTotalInterestCents - 400_000,
    );
  });

  it('has no break-even when the new payment is no lower', () => {
    const worse = compareRefinance({ ...REFERENCE, newRateBps: 800, newTermMonths: 300 });
    expect(worse.monthlySavingCents).toBeLessThan(0);
    expect(worse.breakEvenMonths).toBeNull();
  });

  it('rolling the costs in costs nothing at closing but finances them', () => {
    const rolled = compareRefinance({ ...REFERENCE, rollCostsIntoLoan: true });
    expect(rolled.cashAtClosingCents).toBe(0);
    expect(rolled.breakEvenMonths).toBe(0);
    expect(rolled.newLoanCents).toBe(25_400_000);
    expect(rolled.newPaymentCents).toBeGreaterThan(result.newPaymentCents);
  });
});

describe('payoffMonthsAtCurrentPayment', () => {
  it('clears the new loan well inside its term when the old payment is kept', () => {
    const months = payoffMonthsAtCurrentPayment(REFERENCE);
    expect(months).toBeLessThan(REFERENCE.currentRemainingMonths);
    expect(months).toBeGreaterThan(0);
  });

  it('matches the new term exactly when the rate does not change', () => {
    const sameRate = {
      ...REFERENCE,
      newRateBps: REFERENCE.currentRateBps,
      newTermMonths: REFERENCE.currentRemainingMonths,
      closingCostsCents: 0,
    };
    const payment = monthlyPaymentCents(sameRate.balanceCents, sameRate.currentRateBps, sameRate.currentRemainingMonths);
    expect(payment).toBe(monthlyPaymentCents(sameRate.balanceCents, sameRate.newRateBps, sameRate.newTermMonths));
    expect(payoffMonthsAtCurrentPayment(sameRate)).toBe(REFERENCE.currentRemainingMonths);
  });
});
