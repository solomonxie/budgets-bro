import {
  bracketTaxCents,
  minimumDownPaymentCents,
  mortgageInsurance,
  paymentPlan,
  periodicRate,
  premiumSalesTaxCents,
  requiredIncome,
  stressTestRateBps,
  termSummary,
  TRANSFER_TAX_RULES,
  TORONTO_RULES,
  transferTax,
} from './canadianMortgage';

describe('semi-annual compounding', () => {
  it('discounts a Canadian rate below its American namesake', () => {
    // 5% semi-annual → 0.41239% monthly, against 0.41667% compounded monthly.
    expect(periodicRate(500, 12)).toBeCloseTo(0.0041239, 7);
    expect(periodicRate(500, 12, 'monthly')).toBeCloseTo(0.0041667, 7);
  });

  it('is zero at a zero rate, whichever way it compounds', () => {
    expect(periodicRate(0, 26)).toBe(0);
    expect(periodicRate(0, 26, 'monthly')).toBe(0);
  });
});

describe('paymentPlan', () => {
  // $500,000 at 5.00%, 25 years: $2,908.02/mo on the Canadian convention
  // (ratehub/CMHC calculators agree to the cent).
  it('matches the published monthly payment', () => {
    const plan = paymentPlan(50_000_000, 500, 300);
    expect(plan.paymentCents).toBeCloseTo(290_802, -1);
    expect(plan.monthsToPayoff).toBe(300);
  });

  it('charges monthly compounding more for the same rate', () => {
    const canadian = paymentPlan(50_000_000, 500, 300);
    const american = paymentPlan(50_000_000, 500, 300, 'monthly', 'monthly');
    expect(american.paymentCents).toBeGreaterThan(canadian.paymentCents);
  });

  it('halves the monthly payment for accelerated bi-weekly and finishes early', () => {
    const monthly = paymentPlan(50_000_000, 500, 300);
    const accelerated = paymentPlan(50_000_000, 500, 300, 'acceleratedBiweekly');
    expect(accelerated.paymentCents).toBe(Math.round(monthly.paymentCents / 2));
    // Thirteen months of payments a year takes roughly four years off.
    expect(accelerated.monthsToPayoff).toBeLessThan(270);
    expect(accelerated.totalInterestCents).toBeLessThan(monthly.totalInterestCents);
  });

  it('keeps plain bi-weekly on schedule, unlike accelerated', () => {
    const plain = paymentPlan(50_000_000, 500, 300, 'biweekly');
    expect(plain.monthsToPayoff).toBeGreaterThan(295);
    expect(plain.monthsToPayoff).toBeLessThanOrEqual(301);
  });

  it('returns an empty plan for nothing borrowed', () => {
    expect(paymentPlan(0, 500, 300).paymentCents).toBe(0);
  });
});

describe('termSummary', () => {
  it('leaves most of the balance standing after a five-year term', () => {
    const plan = paymentPlan(50_000_000, 500, 300);
    const term = termSummary(50_000_000, 500, plan, 60);
    // Five years of a 25-year mortgage pays off roughly a seventh of it.
    expect(term.balanceCents).toBeGreaterThan(42_000_000);
    expect(term.balanceCents).toBeLessThan(44_500_000);
    expect(term.interestPaidCents).toBeGreaterThan(term.principalPaidCents);
    expect(term.principalPaidCents + term.balanceCents).toBe(50_000_000);
  });
});

describe('minimumDownPaymentCents', () => {
  it('is 5% below half a million', () => {
    expect(minimumDownPaymentCents(40_000_000)).toBe(2_000_000);
  });

  it('is 5% then 10% between $500k and $1.5M', () => {
    // $700k → 5% of 500k + 10% of 200k = $45,000
    expect(minimumDownPaymentCents(70_000_000)).toBe(4_500_000);
  });

  it('is 20% above the insurable ceiling', () => {
    expect(minimumDownPaymentCents(200_000_000)).toBe(40_000_000);
  });
});

describe('mortgageInsurance', () => {
  it('charges nothing at 20% down', () => {
    const result = mortgageInsurance(70_000_000, 14_000_000, 300);
    expect(result.status).toBe('notRequired');
    expect(result.premiumCents).toBe(0);
    expect(result.totalMortgageCents).toBe(56_000_000);
  });

  it('adds a 4% premium to the mortgage at 5% down', () => {
    // $500k, $25k down → $475k at 95% LTV → 4.00% = $19,000 financed.
    const result = mortgageInsurance(50_000_000, 2_500_000, 300);
    expect(result.status).toBe('insured');
    expect(result.premiumRateBps).toBe(400);
    expect(result.premiumCents).toBe(1_900_000);
    expect(result.totalMortgageCents).toBe(49_400_000);
  });

  it('adds the extended-amortization surcharge past 25 years', () => {
    const at25 = mortgageInsurance(50_000_000, 2_500_000, 300);
    const at30 = mortgageInsurance(50_000_000, 2_500_000, 360);
    expect(at30.premiumRateBps).toBe(at25.premiumRateBps + 20);
  });

  it('refuses a house over the insurable ceiling', () => {
    expect(mortgageInsurance(200_000_000, 20_000_000, 300).status).toBe('priceTooHigh');
  });

  it('refuses a down payment under the statutory minimum', () => {
    expect(mortgageInsurance(70_000_000, 3_500_000, 300).status).toBe('downTooSmall');
  });

  it('taxes the premium only where the province charges it', () => {
    expect(premiumSalesTaxCents(1_900_000, 'ON')).toBe(152_000);
    expect(premiumSalesTaxCents(1_900_000, 'BC')).toBe(0);
  });
});

describe('transfer tax', () => {
  it('matches BC on a $700,000 home', () => {
    // 1% of 200k + 2% of 500k = $12,000
    expect(bracketTaxCents(70_000_000, TRANSFER_TAX_RULES.BC.brackets)).toBe(1_200_000);
  });

  it('matches Ontario on a $700,000 home', () => {
    // 0.5%·55k + 1%·195k + 1.5%·150k + 2%·300k = $10,475
    expect(bracketTaxCents(70_000_000, TRANSFER_TAX_RULES.ON.brackets)).toBe(1_047_500);
  });

  it('caps the first-time-buyer refund and respects the price cap', () => {
    const on = transferTax(70_000_000, TRANSFER_TAX_RULES.ON, true);
    expect(on.rebateCents).toBe(400_000);
    expect(on.netCents).toBe(647_500);

    const bcOverCap = transferTax(90_000_000, TRANSFER_TAX_RULES.BC, true);
    expect(bcOverCap.rebateCents).toBe(0);
  });

  it('adds Toronto’s own tax on the same brackets', () => {
    const provincial = transferTax(70_000_000, TRANSFER_TAX_RULES.ON);
    const municipal = transferTax(70_000_000, TORONTO_RULES);
    expect(municipal.taxCents).toBe(provincial.taxCents);
  });
});

describe('qualifying', () => {
  it('stress-tests at the greater of the floor and rate plus two', () => {
    expect(stressTestRateBps(390)).toBe(590);
    expect(stressTestRateBps(300)).toBe(525);
  });

  it('needs the income the tighter ratio demands', () => {
    const result = requiredIncome({
      paymentCents: 290_000,
      propertyTaxMonthlyCents: 30_000,
      heatMonthlyCents: 10_000,
      condoFeeMonthlyCents: 30_000,
      otherDebtsMonthlyCents: 0,
    });
    // GDS costs $3,450/mo ÷ 39% × 12 = $106,153/yr
    expect(result.gdsMonthlyCents).toBe(345_000);
    expect(result.requiredAnnualCents).toBeCloseTo(10_615_385, -2);
    expect(result.boundBy).toBe('gds');
  });

  it('is bound by TDS once other debts are heavy', () => {
    const result = requiredIncome({
      paymentCents: 290_000,
      propertyTaxMonthlyCents: 30_000,
      heatMonthlyCents: 10_000,
      condoFeeMonthlyCents: 30_000,
      otherDebtsMonthlyCents: 120_000,
    });
    expect(result.boundBy).toBe('tds');
  });
});
