// Canadian mortgage rules. Three things make a mortgage here different from
// the one `amortization.ts` models, and all three change the payment:
//
// 1. A fixed rate is compounded **semi-annually, not in advance** (Interest
//    Act s.6), not monthly — so the periodic rate is a root of the half-year
//    rate, and a 5% Canadian mortgage costs slightly less than a 5% American
//    one. Variable-rate mortgages compound monthly; that's the `monthly`
//    option.
// 2. Payments are made on six schedules, two of which ("accelerated") are
//    deliberately a thirteenth monthly payment a year in disguise.
// 3. Under 20% down the mortgage must be insured, and the premium is added
//    to the amount borrowed — so a smaller down payment raises the balance
//    it was meant to lower.
//
// Statutory figures (down-payment tiers, premium rates, transfer-tax
// brackets) are dated constants below, not live data. They change rarely but
// they do change: every one is exported so a screen can show it and let the
// user override it.

export type PaymentFrequency =
  | 'monthly'
  | 'semiMonthly'
  | 'biweekly'
  | 'acceleratedBiweekly'
  | 'weekly'
  | 'acceleratedWeekly';

export type Compounding = 'semiAnnual' | 'monthly';

export const PAYMENTS_PER_YEAR: Record<PaymentFrequency, number> = {
  monthly: 12,
  semiMonthly: 24,
  biweekly: 26,
  acceleratedBiweekly: 26,
  weekly: 52,
  acceleratedWeekly: 52,
};

// An accelerated schedule isn't a different rate or a different formula: it
// is the monthly payment cut in half (or in quarters) and paid every two
// weeks (or every week), which lands 26 half-payments — thirteen months'
// worth — in a twelve-month year.
export function isAccelerated(frequency: PaymentFrequency): boolean {
  return frequency === 'acceleratedBiweekly' || frequency === 'acceleratedWeekly';
}

export function periodicRate(
  annualRateBps: number,
  periodsPerYear: number,
  compounding: Compounding = 'semiAnnual',
): number {
  const annual = annualRateBps / 10000;
  if (annual === 0) return 0;
  if (compounding === 'monthly') return annual / 12 / (periodsPerYear / 12);
  return Math.pow(1 + annual / 2, 2 / periodsPerYear) - 1;
}

function levelPayment(principalCents: number, rate: number, periods: number): number {
  if (periods <= 0) return principalCents;
  if (rate === 0) return Math.round(principalCents / periods);
  const factor = Math.pow(1 + rate, periods);
  return Math.round((principalCents * rate * factor) / (factor - 1));
}

function periodsToPayoff(principalCents: number, rate: number, paymentCents: number): number {
  if (principalCents <= 0) return 0;
  if (rate === 0) return Math.ceil(principalCents / paymentCents);
  const interest = principalCents * rate;
  if (paymentCents <= interest) return Infinity;
  return Math.ceil(-Math.log(1 - interest / paymentCents) / Math.log(1 + rate));
}

export interface PaymentPlan {
  /** What leaves the account on each payment date. */
  paymentCents: number;
  periodsPerYear: number;
  /** How many payments it actually takes — shorter than scheduled when accelerated. */
  periods: number;
  /** The same, in months, which is how anyone says it out loud. */
  monthsToPayoff: number;
  totalInterestCents: number;
  /** For comparing schedules fairly: what a year of this costs. */
  annualOutlayCents: number;
}

export function paymentPlan(
  principalCents: number,
  annualRateBps: number,
  amortizationMonths: number,
  frequency: PaymentFrequency = 'monthly',
  compounding: Compounding = 'semiAnnual',
): PaymentPlan {
  const periodsPerYear = PAYMENTS_PER_YEAR[frequency];
  const rate = periodicRate(annualRateBps, periodsPerYear, compounding);
  if (principalCents <= 0 || amortizationMonths <= 0) {
    return {
      paymentCents: 0,
      periodsPerYear,
      periods: 0,
      monthsToPayoff: 0,
      totalInterestCents: 0,
      annualOutlayCents: 0,
    };
  }

  let paymentCents: number;
  if (isAccelerated(frequency)) {
    const monthlyRate = periodicRate(annualRateBps, 12, compounding);
    const monthly = levelPayment(principalCents, monthlyRate, amortizationMonths);
    paymentCents = Math.round(monthly / (frequency === 'acceleratedBiweekly' ? 2 : 4));
  } else {
    paymentCents = levelPayment(
      principalCents,
      rate,
      Math.round((amortizationMonths / 12) * periodsPerYear),
    );
  }

  // A payment rounded to the cent leaves a few cents standing at the end,
  // which the payoff formula reports as a whole extra period. For a
  // scheduled payment that is an artefact, not a fact: the contract says 25
  // years, so say 25 years. An accelerated schedule really does finish
  // early, so there the computed figure is the answer.
  const scheduledPeriods = Math.round((amortizationMonths / 12) * periodsPerYear);
  const periods = isAccelerated(frequency)
    ? periodsToPayoff(principalCents, rate, paymentCents)
    : scheduledPeriods;
  const monthsToPayoff = Number.isFinite(periods)
    ? Math.round((periods / periodsPerYear) * 12)
    : Infinity;
  const totalInterestCents = Number.isFinite(periods)
    ? Math.max(0, paymentCents * periods - principalCents)
    : Infinity;

  return {
    paymentCents,
    periodsPerYear,
    periods,
    monthsToPayoff,
    totalInterestCents,
    annualOutlayCents: paymentCents * periodsPerYear,
  };
}

// What a five-year term costs and leaves behind. A Canadian mortgage is
// amortized over 25 or 30 years but only *contracted* for a term of one to
// ten, and the balance at the end of that term is the number the renewal is
// negotiated against — so it matters more than the payoff date.
export interface TermSummary {
  interestPaidCents: number;
  principalPaidCents: number;
  balanceCents: number;
}

export function termSummary(
  principalCents: number,
  annualRateBps: number,
  plan: PaymentPlan,
  termMonths: number,
  compounding: Compounding = 'semiAnnual',
): TermSummary {
  const rate = periodicRate(annualRateBps, plan.periodsPerYear, compounding);
  const periods = Math.min(
    Math.round((termMonths / 12) * plan.periodsPerYear),
    Number.isFinite(plan.periods) ? plan.periods : Number.MAX_SAFE_INTEGER,
  );
  let balance = principalCents;
  let interest = 0;
  for (let i = 0; i < periods && balance > 0; i++) {
    const periodInterest = Math.round(balance * rate);
    const principalPart = Math.min(plan.paymentCents - periodInterest, balance);
    interest += periodInterest;
    balance -= principalPart;
  }
  return {
    interestPaidCents: interest,
    principalPaidCents: principalCents - Math.max(0, balance),
    balanceCents: Math.max(0, balance),
  };
}

// --- Down payment and default insurance -------------------------------
// Tiers as of 2024-12-15, when the insurable ceiling rose from $1M to $1.5M.

export const INSURABLE_PRICE_CEILING_CENTS = 150_000_000;
const TIER_ONE_CENTS = 50_000_000; // 5% applies below this
const TIER_ONE_PERCENT = 5;
const TIER_TWO_PERCENT = 10;
const UNINSURABLE_PERCENT = 20;

export function minimumDownPaymentCents(priceCents: number): number {
  if (priceCents <= 0) return 0;
  if (priceCents > INSURABLE_PRICE_CEILING_CENTS) {
    return Math.round((priceCents * UNINSURABLE_PERCENT) / 100);
  }
  if (priceCents <= TIER_ONE_CENTS) {
    return Math.ceil((priceCents * TIER_ONE_PERCENT) / 100);
  }
  return Math.ceil(
    (TIER_ONE_CENTS * TIER_ONE_PERCENT) / 100 +
      ((priceCents - TIER_ONE_CENTS) * TIER_TWO_PERCENT) / 100,
  );
}

// CMHC/Sagen/Canada Guaranty share one published table, by loan-to-value.
// Rates as of 2024; the 30-year surcharge is the extended-amortization
// add-on available to first-time buyers and new builds.
export const PREMIUM_BANDS: { maxLtvBps: number; rateBps: number }[] = [
  { maxLtvBps: 6500, rateBps: 60 },
  { maxLtvBps: 7500, rateBps: 170 },
  { maxLtvBps: 8000, rateBps: 240 },
  { maxLtvBps: 8500, rateBps: 280 },
  { maxLtvBps: 9000, rateBps: 310 },
  { maxLtvBps: 9500, rateBps: 400 },
];
export const EXTENDED_AMORTIZATION_SURCHARGE_BPS = 20;

export type InsuranceStatus =
  | 'notRequired'
  | 'insured'
  | 'priceTooHigh'
  | 'downTooSmall';

export interface MortgageInsurance {
  status: InsuranceStatus;
  ltvBps: number;
  premiumRateBps: number;
  premiumCents: number;
  /** Premium financed into the mortgage — the amount actually borrowed. */
  totalMortgageCents: number;
}

export function mortgageInsurance(
  priceCents: number,
  downPaymentCents: number,
  amortizationMonths: number,
): MortgageInsurance {
  const baseCents = Math.max(0, priceCents - downPaymentCents);
  const ltvBps = priceCents > 0 ? Math.round((baseCents / priceCents) * 10000) : 0;
  const none = (status: InsuranceStatus): MortgageInsurance => ({
    status,
    ltvBps,
    premiumRateBps: 0,
    premiumCents: 0,
    totalMortgageCents: baseCents,
  });

  if (baseCents <= 0) return none('notRequired');
  // 20% down or more needs no insurance; above the ceiling it cannot have
  // any, which is why that price demands 20% in the first place.
  if (ltvBps <= 8000) return none('notRequired');
  if (priceCents > INSURABLE_PRICE_CEILING_CENTS) return none('priceTooHigh');
  if (downPaymentCents < minimumDownPaymentCents(priceCents)) return none('downTooSmall');

  const band = PREMIUM_BANDS.find((b) => ltvBps <= b.maxLtvBps);
  if (!band) return none('downTooSmall');
  const surcharge = amortizationMonths > 300 ? EXTENDED_AMORTIZATION_SURCHARGE_BPS : 0;
  const premiumRateBps = band.rateBps + surcharge;
  const premiumCents = Math.round((baseCents * premiumRateBps) / 10000);

  return {
    status: 'insured',
    ltvBps,
    premiumRateBps,
    premiumCents,
    totalMortgageCents: baseCents + premiumCents,
  };
}

// The premium itself is financed; the sales tax on it is not — it is due in
// cash at closing, in the four provinces that charge it.
export const PREMIUM_TAX_BPS: Record<string, number> = {
  ON: 800,
  QC: 900,
  SK: 600,
  MB: 700,
};

export function premiumSalesTaxCents(premiumCents: number, province: string): number {
  return Math.round((premiumCents * (PREMIUM_TAX_BPS[province] ?? 0)) / 10000);
}

// --- Land / property transfer tax -------------------------------------
// Brackets are provincial statute, shipped for the provinces that charge a
// value-based tax and checked against the province's own calculator. Every
// screen using these shows the as-of date and takes an override, because a
// budget for a house purchase must not quietly rest on a stale table.

export const TRANSFER_TAX_AS_OF = '2026-09';

export interface TaxBracket {
  /** Upper bound of the band, or null for "everything above". */
  upToCents: number | null;
  rateBps: number;
}

export interface TransferTaxRules {
  brackets: TaxBracket[];
  /** Biggest refund a first-time buyer can get back. */
  firstTimeBuyerMaxRefundCents: number;
  /** Price above which no first-time-buyer relief applies at all. */
  firstTimeBuyerPriceCapCents: number | null;
}

export const TRANSFER_TAX_RULES: Record<string, TransferTaxRules> = {
  // 1% to $200k, 2% to $2M, 3% to $3M, 5% above (the extra 2% applies to
  // residential value over $3M).
  BC: {
    brackets: [
      { upToCents: 20_000_000, rateBps: 100 },
      { upToCents: 200_000_000, rateBps: 200 },
      { upToCents: 300_000_000, rateBps: 300 },
      { upToCents: null, rateBps: 500 },
    ],
    firstTimeBuyerMaxRefundCents: 800_000,
    firstTimeBuyerPriceCapCents: 83_500_000,
  },
  ON: {
    brackets: [
      { upToCents: 5_500_000, rateBps: 50 },
      { upToCents: 25_000_000, rateBps: 100 },
      { upToCents: 40_000_000, rateBps: 150 },
      { upToCents: 200_000_000, rateBps: 200 },
      { upToCents: null, rateBps: 250 },
    ],
    firstTimeBuyerMaxRefundCents: 400_000,
    firstTimeBuyerPriceCapCents: null,
  },
  MB: {
    brackets: [
      { upToCents: 3_000_000, rateBps: 0 },
      { upToCents: 9_000_000, rateBps: 50 },
      { upToCents: 15_000_000, rateBps: 100 },
      { upToCents: 20_000_000, rateBps: 150 },
      { upToCents: null, rateBps: 200 },
    ],
    firstTimeBuyerMaxRefundCents: 0,
    firstTimeBuyerPriceCapCents: null,
  },
  NS: {
    brackets: [{ upToCents: null, rateBps: 150 }],
    firstTimeBuyerMaxRefundCents: 0,
    firstTimeBuyerPriceCapCents: null,
  },
  NB: {
    brackets: [{ upToCents: null, rateBps: 100 }],
    firstTimeBuyerMaxRefundCents: 0,
    firstTimeBuyerPriceCapCents: null,
  },
  PE: {
    brackets: [{ upToCents: null, rateBps: 100 }],
    firstTimeBuyerMaxRefundCents: 0,
    firstTimeBuyerPriceCapCents: null,
  },
};

// Toronto charges its own tax on top, on the same brackets as Ontario's,
// with a first-time-buyer rebate of its own.
export const TORONTO_RULES: TransferTaxRules = {
  brackets: TRANSFER_TAX_RULES.ON.brackets,
  firstTimeBuyerMaxRefundCents: 447_500,
  firstTimeBuyerPriceCapCents: null,
};

/** Provinces charging a flat registration fee instead of a value-based tax. */
export const NO_TRANSFER_TAX_PROVINCES = ['AB', 'SK', 'NL', 'YT', 'NT', 'NU'];

export function bracketTaxCents(priceCents: number, brackets: TaxBracket[]): number {
  let tax = 0;
  let from = 0;
  for (const band of brackets) {
    const to = band.upToCents ?? priceCents;
    if (priceCents <= from) break;
    const slice = Math.min(priceCents, to) - from;
    if (slice > 0) tax += (slice * band.rateBps) / 10000;
    from = to;
  }
  return Math.round(tax);
}

export interface TransferTax {
  taxCents: number;
  rebateCents: number;
  /** What actually has to be paid. */
  netCents: number;
}

export function transferTax(
  priceCents: number,
  rules: TransferTaxRules,
  firstTimeBuyer = false,
): TransferTax {
  const taxCents = bracketTaxCents(priceCents, rules.brackets);
  const eligible =
    firstTimeBuyer &&
    (rules.firstTimeBuyerPriceCapCents == null ||
      priceCents <= rules.firstTimeBuyerPriceCapCents);
  const rebateCents = eligible
    ? Math.min(taxCents, rules.firstTimeBuyerMaxRefundCents)
    : 0;
  return { taxCents, rebateCents, netCents: taxCents - rebateCents };
}

// --- Qualifying: the stress test, GDS and TDS -------------------------

export const STRESS_TEST_FLOOR_BPS = 525;
export const STRESS_TEST_MARGIN_BPS = 200;

export function stressTestRateBps(contractRateBps: number): number {
  return Math.max(STRESS_TEST_FLOOR_BPS, contractRateBps + STRESS_TEST_MARGIN_BPS);
}

export const GDS_LIMIT_PERCENT = 39;
export const TDS_LIMIT_PERCENT = 44;

export interface QualifyingCosts {
  /** Mortgage payment at the *qualifying* rate, monthly. */
  paymentCents: number;
  propertyTaxMonthlyCents: number;
  heatMonthlyCents: number;
  condoFeeMonthlyCents: number;
  otherDebtsMonthlyCents: number;
}

/** Lenders count half of a condo fee toward the ratios, not all of it. */
export function gdsMonthlyCents(costs: QualifyingCosts): number {
  return (
    costs.paymentCents +
    costs.propertyTaxMonthlyCents +
    costs.heatMonthlyCents +
    Math.round(costs.condoFeeMonthlyCents / 2)
  );
}

export interface RequiredIncome {
  gdsMonthlyCents: number;
  tdsMonthlyCents: number;
  /** Gross annual income needed to satisfy both ratios. */
  requiredAnnualCents: number;
  /** Which ratio was the binding one. */
  boundBy: 'gds' | 'tds';
}

export function requiredIncome(
  costs: QualifyingCosts,
  gdsLimitPercent = GDS_LIMIT_PERCENT,
  tdsLimitPercent = TDS_LIMIT_PERCENT,
): RequiredIncome {
  const gds = gdsMonthlyCents(costs);
  const tds = gds + costs.otherDebtsMonthlyCents;
  const byGds = Math.round(((gds * 12) / gdsLimitPercent) * 100);
  const byTds = Math.round(((tds * 12) / tdsLimitPercent) * 100);
  return {
    gdsMonthlyCents: gds,
    tdsMonthlyCents: tds,
    requiredAnnualCents: Math.max(byGds, byTds),
    boundBy: byTds >= byGds ? 'tds' : 'gds',
  };
}
