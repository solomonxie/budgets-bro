import { compareRentVsBuy } from './rentVsBuy';

// A conventional set of assumptions: $400k house, 20% down, 6.5% over 30
// years, 3% closing, 1.2% tax, 0.5% insurance, 1% upkeep, 3% appreciation,
// 6% selling costs, $2,000 rent growing 3%/yr, 7% on invested cash.
const REFERENCE = {
  years: 30,
  monthlyRentCents: 200_000,
  annualRentGrowthBps: 300,
  priceCents: 40_000_000,
  downPaymentCents: 8_000_000,
  annualRateBps: 650,
  termMonths: 360,
  closingCostBps: 300,
  propertyTaxAnnualBps: 120,
  insuranceAnnualBps: 50,
  maintenanceAnnualBps: 100,
  hoaMonthlyCents: 0,
  annualAppreciationBps: 300,
  sellingCostBps: 600,
  annualInvestmentReturnBps: 700,
};

describe('compareRentVsBuy', () => {
  const result = compareRentVsBuy(REFERENCE);

  it('returns one row per year and the loan payment behind them', () => {
    expect(result.rows).toHaveLength(30);
    expect(result.monthlyPaymentCents).toBeCloseTo(202_257, -2);
    expect(result.upfrontCents).toBe(8_000_000 + 1_200_000);
  });

  it('starts the renter with the buyer’s whole up-front outlay invested', () => {
    // One year of 7% growth on the down payment plus closing costs, before
    // any monthly difference is added.
    expect(result.rows[0].renterPortfolioCents).toBeGreaterThan(result.upfrontCents);
  });

  it('pays the loan off exactly at the end of the term', () => {
    expect(result.rows[29].loanBalanceCents).toBe(0);
  });

  it('leaves the buyer behind in year one, on selling costs alone', () => {
    expect(result.rows[0].advantageCents).toBeLessThan(0);
  });

  it('never breaks even where rent is cheap and the market beats the house', () => {
    // $2,000/month against a $400k house, 3% appreciation against a 7%
    // portfolio: renting genuinely wins here, and the honest answer is that
    // there is no break-even rather than one somewhere past the horizon.
    expect(result.breakEvenYear).toBeNull();
    expect(result.rows[29].advantageCents).toBeLessThan(0);
  });

  it('breaks even early once rent is dear and the house keeps up with the market', () => {
    const buyWins = compareRentVsBuy({
      ...REFERENCE,
      monthlyRentCents: 280_000,
      annualRentGrowthBps: 400,
      annualAppreciationBps: 400,
      annualInvestmentReturnBps: 500,
    });
    expect(buyWins.breakEvenYear).toBe(3);
    expect(buyWins.rows[1].advantageCents).toBeLessThan(0);
    expect(buyWins.rows[2].advantageCents).toBeGreaterThan(0);
  });

  it('grows the rent every year', () => {
    expect(result.rows[1].rentThisYearCents).toBeGreaterThan(result.rows[0].rentThisYearCents);
  });

  it('returns nothing at all for a zero-year horizon', () => {
    expect(compareRentVsBuy({ ...REFERENCE, years: 0 }).rows).toHaveLength(0);
  });
});
