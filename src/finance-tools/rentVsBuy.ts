import { monthlyPaymentCents, monthlyRateFromBps } from './amortization';

// The comparison only means something if the renter's down payment is
// invested rather than vanishing: otherwise "buying wins" is just an artifact
// of one side saving money and the other not. Both sides are carried forward
// month by month and compared as net worth at each year end — what you'd walk
// away with if you sold (or cashed out) that year.
export interface RentVsBuyInput {
  years: number;
  monthlyRentCents: number;
  annualRentGrowthBps: number;

  priceCents: number;
  downPaymentCents: number;
  annualRateBps: number;
  termMonths: number;
  closingCostBps: number;
  propertyTaxAnnualBps: number;
  insuranceAnnualBps: number;
  maintenanceAnnualBps: number;
  hoaMonthlyCents: number;
  annualAppreciationBps: number;
  // Agent commission and the rest — charged against the sale price, which is
  // why buying takes a few years to come out ahead even when it eventually does.
  sellingCostBps: number;

  // What the renter's down payment (and any month where renting is cheaper)
  // earns instead. This is the assumption the whole answer hinges on.
  annualInvestmentReturnBps: number;
}

export interface RentVsBuyYearRow {
  year: number;
  rentThisYearCents: number;
  cumulativeRentCents: number;
  renterPortfolioCents: number;
  // The buyer invests too — every month owning is the cheaper side, which is
  // most of them once the mortgage is gone. Without this the comparison
  // quietly hands the renter the only savings account.
  buyerPortfolioCents: number;
  homeValueCents: number;
  loanBalanceCents: number;
  buyerCostThisYearCents: number;
  cumulativeBuyerCostCents: number;
  // Sale proceeds after costs, minus what's still owed.
  buyerEquityCents: number;
  // Buyer's net position minus the renter's. Positive means buying is ahead
  // by the end of that year.
  advantageCents: number;
}

export interface RentVsBuyResult {
  rows: RentVsBuyYearRow[];
  monthlyPaymentCents: number;
  upfrontCents: number;
  // First year where buying pulls ahead and stays ahead through the horizon,
  // or null if it never does within `years`.
  breakEvenYear: number | null;
}

function monthlyRate(annualBps: number): number {
  return Math.pow(1 + annualBps / 10000, 1 / 12) - 1;
}

export function compareRentVsBuy(input: RentVsBuyInput): RentVsBuyResult {
  const loanCents = Math.max(0, input.priceCents - input.downPaymentCents);
  const payment = monthlyPaymentCents(loanCents, input.annualRateBps, input.termMonths);
  const closingCents = Math.round((input.priceCents * input.closingCostBps) / 10000);
  const upfrontCents = input.downPaymentCents + closingCents;

  const loanMonthlyRate = monthlyRateFromBps(input.annualRateBps);
  const appreciation = monthlyRate(input.annualAppreciationBps);
  const investmentGrowth = monthlyRate(input.annualInvestmentReturnBps);
  const rentGrowth = input.annualRentGrowthBps / 10000;

  let balance = loanCents;
  let homeValue = input.priceCents;
  // The renter starts with the buyer's whole up-front outlay invested — that
  // head start is exactly what the buyer is giving up.
  let renterPortfolio = upfrontCents;
  let buyerPortfolio = 0;
  let rent = input.monthlyRentCents;
  let cumulativeRent = 0;
  let cumulativeBuyerCost = upfrontCents;

  const rows: RentVsBuyYearRow[] = [];
  const totalYears = Math.max(0, Math.floor(input.years));

  for (let year = 1; year <= totalYears; year += 1) {
    let rentThisYear = 0;
    let buyerCostThisYear = 0;

    for (let month = 0; month < 12; month += 1) {
      const interest = balance * loanMonthlyRate;
      const principal = Math.min(Math.max(0, payment - interest), balance);
      // A paid-off loan still costs tax, insurance, upkeep and dues.
      const debtService = balance > 0 ? interest + principal : 0;
      balance = Math.max(0, balance - principal);

      const carrying =
        (homeValue * (input.propertyTaxAnnualBps + input.insuranceAnnualBps + input.maintenanceAnnualBps)) / 10000 / 12 +
        input.hoaMonthlyCents;
      const buyerMonthly = debtService + carrying;
      const renterMonthly = rent;

      rentThisYear += renterMonthly;
      buyerCostThisYear += buyerMonthly;

      // Whichever side is cheaper this month invests the difference, so both
      // sides spend the same budget every month and the comparison is between
      // what each one is left holding.
      const difference = buyerMonthly - renterMonthly;
      renterPortfolio = renterPortfolio * (1 + investmentGrowth) + Math.max(0, difference);
      buyerPortfolio = buyerPortfolio * (1 + investmentGrowth) + Math.max(0, -difference);
      homeValue *= 1 + appreciation;
    }

    rent *= 1 + rentGrowth;
    cumulativeRent += rentThisYear;
    cumulativeBuyerCost += buyerCostThisYear;

    const netSaleCents = homeValue * (1 - input.sellingCostBps / 10000);
    const buyerEquityCents = Math.round(netSaleCents - balance);
    const renterPortfolioCents = Math.round(renterPortfolio);
    const buyerPortfolioCents = Math.round(buyerPortfolio);

    rows.push({
      year,
      rentThisYearCents: Math.round(rentThisYear),
      cumulativeRentCents: Math.round(cumulativeRent),
      renterPortfolioCents,
      buyerPortfolioCents,
      homeValueCents: Math.round(homeValue),
      loanBalanceCents: Math.round(balance),
      buyerCostThisYearCents: Math.round(buyerCostThisYear),
      cumulativeBuyerCostCents: Math.round(cumulativeBuyerCost),
      buyerEquityCents,
      // Both sides already paid for their own housing out of the same
      // monthly budget, so the comparison is asset against asset.
      advantageCents: buyerEquityCents + buyerPortfolioCents - renterPortfolioCents,
    });
  }

  // The last year that's still negative, plus one — a single early year in
  // the black (possible when the sale price jumps past the costs on paper)
  // isn't the break-even anyone means.
  const lastNegative = rows.reduce((last, row) => (row.advantageCents < 0 ? row.year : last), 0);
  const breakEven = lastNegative < rows.length ? lastNegative + 1 : null;

  return { rows, monthlyPaymentCents: payment, upfrontCents, breakEvenYear: breakEven };
}
