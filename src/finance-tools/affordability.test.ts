import { CONVENTIONAL_28_36, dtiRatios, maxAffordablePrice, maxPriceFromMonthlyBudget, monthlyHousingCost } from './affordability';

// calculator.net's house affordability example: $120,000 income, 30 years at
// 7.044%, no other debt, 20% down, 1.5% property tax, 0.5% insurance, 28/36.
const REFERENCE = {
  annualIncomeCents: 12_000_000,
  monthlyDebtCents: 0,
  rule: CONVENTIONAL_28_36,
  costs: {
    annualRateBps: 704.4,
    termMonths: 360,
    downPaymentPercent: 20,
    propertyTaxAnnualBps: 150,
    insuranceAnnualBps: 50,
  },
};

describe('maxAffordablePrice', () => {
  const result = maxAffordablePrice(REFERENCE);

  it('reproduces the reference price, loan and down payment to the dollar', () => {
    expect(result.maxHousePriceCents).toBeCloseTo(39_927_300, -3);
    expect(result.loanCents).toBeCloseTo(31_941_800, -3);
    expect(result.downPaymentCents).toBeCloseTo(7_985_500, -3);
  });

  it('reproduces the reference monthly costs', () => {
    expect(result.principalInterestCents).toBeCloseTo(213_500, -3);
    expect(result.propertyTaxCents * 12).toBeCloseTo(598_900, -3);
    expect(result.insuranceCents * 12).toBeCloseTo(199_600, -3);
    expect(result.maintenanceCents * 12).toBeCloseTo(598_900, -3);
    expect(result.totalMonthlyCents).toBeCloseTo(329_900, -3);
  });

  it('reproduces the reference closing figures', () => {
    expect(result.closingCostCents).toBeCloseTo(1_197_800, -3);
    expect(result.totalAtClosingCents).toBeCloseTo(9_183_300, -3);
  });

  it('lands exactly on the front-end cap when no other debt binds', () => {
    expect(result.frontEndPercent).toBeCloseTo(28, 4);
    expect(result.backEndPercent).toBeCloseTo(28, 4);
  });

  it('leaves upkeep out of the ratio a lender checks', () => {
    // 28% of $10,000/mo is $2,800 — maintenance would have blown past it.
    expect(result.dtiHousingCents).toBeLessThan(result.totalMonthlyCents);
    expect(result.dtiHousingCents / (REFERENCE.annualIncomeCents / 12)).toBeCloseTo(0.28, 4);
  });

  it('buys less house at a higher rate', () => {
    const pricier = maxAffordablePrice({ ...REFERENCE, costs: { ...REFERENCE.costs, annualRateBps: 900 } });
    expect(pricier.maxHousePriceCents).toBeLessThan(maxAffordablePrice(REFERENCE).maxHousePriceCents);
  });

  it('lets existing debt bind the back-end cap instead', () => {
    // $1,000/mo of car and student loans: 36% of $10,000 is $3,600, leaving
    // $2,600 for housing — below the $2,800 front-end cap.
    const withDebt = maxAffordablePrice({ ...REFERENCE, monthlyDebtCents: 100_000 });
    expect(withDebt.maxHousePriceCents).toBeLessThan(maxAffordablePrice(REFERENCE).maxHousePriceCents);
    expect(withDebt.backEndPercent).toBeCloseTo(36, 3);
  });

  it('affords nothing rather than NaN on no income', () => {
    const broke = maxAffordablePrice({ ...REFERENCE, annualIncomeCents: 0 });
    expect(broke.maxHousePriceCents).toBe(0);
    expect(broke.frontEndPercent).toBe(0);
  });

  it('affords nothing when existing debt already exceeds the allowance', () => {
    expect(maxAffordablePrice({ ...REFERENCE, monthlyDebtCents: 500_000 }).maxHousePriceCents).toBe(0);
  });
});

describe('maxPriceFromMonthlyBudget', () => {
  it('spends the whole budget', () => {
    const result = maxPriceFromMonthlyBudget(350_000, REFERENCE.costs);
    expect(result.totalMonthlyCents).toBeCloseTo(350_000, -2);
  });

  it('buys more house when upkeep sits outside the budget', () => {
    const inclusive = maxPriceFromMonthlyBudget(350_000, REFERENCE.costs, true);
    const exclusive = maxPriceFromMonthlyBudget(350_000, REFERENCE.costs, false);
    expect(exclusive.maxHousePriceCents).toBeGreaterThan(inclusive.maxHousePriceCents);
  });

  it('affords nothing on a zero budget', () => {
    expect(maxPriceFromMonthlyBudget(0, REFERENCE.costs).maxHousePriceCents).toBe(0);
  });
});

describe('monthlyHousingCost', () => {
  it('takes a flat annual sum as readily as a rate', () => {
    const byRate = monthlyHousingCost(40_000_000, { annualRateBps: 600, termMonths: 360, insuranceAnnualBps: 50 });
    const bySum = monthlyHousingCost(40_000_000, { annualRateBps: 600, termMonths: 360, insuranceAnnualCents: 200_000 });
    expect(byRate.insuranceCents).toBe(Math.round(40_000_000 * 0.005 / 12));
    expect(bySum.insuranceCents).toBe(Math.round(200_000 / 12));
  });

  it('never borrows a negative amount when the down payment covers the price', () => {
    const cost = monthlyHousingCost(10_000_000, { annualRateBps: 600, termMonths: 360, downPaymentCents: 20_000_000 });
    expect(cost.loanCents).toBe(0);
    expect(cost.downPaymentCents).toBe(10_000_000);
  });
});

describe('dtiRatios', () => {
  it('splits housing from total debt', () => {
    const r = dtiRatios({ monthlyIncomeCents: 1_000_000, housingCents: 280_000, otherDebtCents: 80_000 });
    expect(r.frontEndPercent).toBeCloseTo(28);
    expect(r.backEndPercent).toBeCloseTo(36);
  });

  it('returns zeros rather than dividing by zero income', () => {
    expect(dtiRatios({ monthlyIncomeCents: 0, housingCents: 100, otherDebtCents: 0 })).toEqual({
      frontEndPercent: 0,
      backEndPercent: 0,
    });
  });
});
