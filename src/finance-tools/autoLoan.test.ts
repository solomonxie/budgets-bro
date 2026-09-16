import { computeAutoLoan } from './autoLoan';

// calculator.net's auto loan example: $50,000 car, 60 months at 5%, $10,000
// down, $5,000 trade-in, 7% sales tax, $2,200 in title/registration/fees,
// trade-in credited against the taxable amount.
const REFERENCE = {
  priceCents: 5_000_000,
  downPaymentCents: 1_000_000,
  tradeInValueCents: 500_000,
  amountOwedOnTradeCents: 0,
  salesTaxBps: 700,
  tradeInReducesTaxableAmount: true,
  feesCents: 220_000,
  annualRateBps: 500,
  termMonths: 60,
};

describe('computeAutoLoan', () => {
  const result = computeAutoLoan(REFERENCE);

  it('taxes the price less the trade-in', () => {
    expect(result.taxableCents).toBe(4_500_000);
    expect(result.salesTaxCents).toBe(315_000);
  });

  it('reproduces the amount financed and the payment', () => {
    expect(result.amountFinancedCents).toBe(4_035_000);
    expect(result.monthlyPaymentCents).toBeCloseTo(76_145, -2);
  });

  it('reports total interest against the amount financed, not the price', () => {
    expect(result.totalInterestCents).toBe(result.totalOfPaymentsCents - result.amountFinancedCents);
    expect(result.totalCostCents).toBe(result.totalOfPaymentsCents + REFERENCE.downPaymentCents);
  });

  it('taxes the full price where the trade-in earns no credit', () => {
    const noCredit = computeAutoLoan({ ...REFERENCE, tradeInReducesTaxableAmount: false });
    expect(noCredit.taxableCents).toBe(5_000_000);
    expect(noCredit.salesTaxCents).toBe(350_000);
    expect(noCredit.amountFinancedCents).toBeGreaterThan(result.amountFinancedCents);
  });

  it('rolls a trade-in that still owes more than it is worth into the new loan', () => {
    const underwater = computeAutoLoan({ ...REFERENCE, amountOwedOnTradeCents: 900_000 });
    expect(underwater.tradeInEquityCents).toBe(-400_000);
    expect(underwater.amountFinancedCents).toBe(result.amountFinancedCents + 900_000);
  });

  it('never finances a negative amount when the down payment covers everything', () => {
    const paidUp = computeAutoLoan({ ...REFERENCE, downPaymentCents: 9_000_000 });
    expect(paidUp.amountFinancedCents).toBe(0);
    expect(paidUp.monthlyPaymentCents).toBe(0);
  });
});
