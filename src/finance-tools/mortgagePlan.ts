// Everything the Mortgage page shows, from one set of inputs: what buying
// costs each month, what it takes on closing day, the income a lender wants,
// the month-by-month schedule (with any extra payments planned into it), and
// what renewal at a higher rate would do. Canadian rules throughout — see
// canadianMortgage.ts for the statute behind each figure.
import {
  minimumDownPaymentCents,
  mortgageInsurance,
  paymentPlan,
  periodicRate,
  premiumSalesTaxCents,
  requiredIncome,
  stressTestRateBps,
  transferTax,
  TORONTO_RULES,
  TRANSFER_TAX_RULES,
} from './canadianMortgage';
import type {
  Compounding,
  MortgageInsurance,
  PaymentFrequency,
  PaymentPlan,
  RequiredIncome,
  TransferTax,
} from './canadianMortgage';

export type DownPayment =
  { unit: 'percent'; percent: number } | { unit: 'amount'; cents: number };

export interface PlanInput {
  priceCents: number;
  down: DownPayment;
  rateBps: number;
  amortizationMonths: number;
  termMonths: number;
  frequency: PaymentFrequency;
  compounding: Compounding;
  province: string;
  firstTimeBuyer: boolean;
  toronto: boolean;
  /** Yearly, as a share of the price, the way cities set it. */
  propertyTaxBps: number;
  condoFeesCents: number;
  heatCents: number;
  otherMonthlyCents: number;
  rentalIncomeCents: number;
  otherClosingCents: number;
  /** Gross, yearly. 0 when not given. */
  annualIncomeCents: number;
  otherDebtsMonthlyCents: number;
  prepayments: Prepayments;
  /**
   * A mortgage already held: its balance and payment replace the purchase
   * (no down payment, insurance or closing), and `priceCents` is what the
   * home is worth today.
   */
  existing?: { balanceCents: number; monthlyPaymentCents: number };
}

/**
 * Money paid on top of the schedule, keyed by month number (1 = first
 * payment). `recurring` is a step: each entry is paid every month from its
 * key until the next entry (0 stops it). A `lumps` entry replaces that one
 * month's recurring amount.
 */
export interface Prepayments {
  monthlyCents: number;
  yearlyCents: number;
  lumps: Record<number, number>;
  recurring?: Record<number, number>;
}

/** The recurring extra in effect at `month`. */
export function recurringAt(
  recurring: Record<number, number> | undefined,
  month: number,
): number {
  let start = 0;
  let cents = 0;
  for (const [key, value] of Object.entries(recurring ?? {})) {
    const m = Number(key);
    if (m <= month && m >= start) {
      start = m;
      cents = value;
    }
  }
  return cents;
}

/** What's paid on top in `month`: its one-off if set, else the recurring amount. */
export function plannedExtraAt(
  prepayments: Prepayments,
  month: number,
): number {
  return prepayments.lumps[month] ?? recurringAt(prepayments.recurring, month);
}

export const NO_PREPAYMENTS: Prepayments = {
  monthlyCents: 0,
  yearlyCents: 0,
  lumps: {},
};

export function downPaymentCents(
  priceCents: number,
  down: DownPayment,
): number {
  if (down.unit === 'amount')
    return Math.min(Math.max(0, down.cents), priceCents);
  const percent = Math.min(Math.max(0, down.percent), 100);
  return Math.round((priceCents * percent) / 100);
}

// --- Month-by-month schedule ------------------------------------------

export interface ScheduleRow {
  month: number;
  paymentCents: number;
  principalCents: number;
  interestCents: number;
  /** Planned on top of the regular payment, all in principal. */
  extraCents: number;
  balanceCents: number;
}

// Monthly whatever the payment frequency: a person plans in months, and a
// biweekly schedule is shown as what it pays per month. Stops at payoff, or
// when the payment no longer covers the interest.
export function monthlySchedule(
  principalCents: number,
  rateBps: number,
  compounding: Compounding,
  monthlyPaymentCents: number,
  prepayments: Prepayments = NO_PREPAYMENTS,
  maxMonths = 600,
): ScheduleRow[] {
  const rate = periodicRate(rateBps, 12, compounding);
  const rows: ScheduleRow[] = [];
  let balance = principalCents;
  for (let month = 1; balance > 0 && month <= maxMonths; month++) {
    const interest = Math.round(balance * rate);
    const regular = Math.min(monthlyPaymentCents, balance + interest);
    let extra =
      prepayments.monthlyCents +
      (month % 12 === 0 ? prepayments.yearlyCents : 0) +
      plannedExtraAt(prepayments, month);
    if (regular <= interest && extra <= 0) break;
    extra = Math.max(0, Math.min(extra, balance + interest - regular));
    const principal = regular - interest + extra;
    balance -= principal;
    rows.push({
      month,
      paymentCents: regular,
      principalCents: regular - interest,
      interestCents: interest,
      extraCents: extra,
      balanceCents: Math.max(0, balance),
    });
  }
  return rows;
}

function paysOff(rows: ScheduleRow[]): boolean {
  return rows.length > 0 && rows[rows.length - 1].balanceCents === 0;
}

function interestOf(rows: ScheduleRow[]): number {
  return rows.reduce((sum, row) => sum + row.interestCents, 0);
}

function balanceAfter(
  rows: ScheduleRow[],
  principalCents: number,
  months: number,
): number {
  if (months <= 0) return principalCents;
  return (
    rows[Math.min(months, rows.length) - 1]?.balanceCents ?? principalCents
  );
}

// --- Qualifying ---------------------------------------------------------

interface QualifyingInput {
  priceCents: number;
  down: DownPayment;
  amortizationMonths: number;
  rateBps: number;
  propertyTaxBps: number;
  heatCents: number;
  condoFeesCents: number;
  otherDebtsMonthlyCents: number;
}

function qualifyingAt(input: QualifyingInput, priceCents: number) {
  const downCents = downPaymentCents(priceCents, input.down);
  const insurance = mortgageInsurance(
    priceCents,
    downCents,
    input.amortizationMonths,
  );
  const stressRateBps = stressTestRateBps(input.rateBps);
  const stressPaymentCents = paymentPlan(
    insurance.totalMortgageCents,
    stressRateBps,
    input.amortizationMonths,
  ).paymentCents;
  const required = requiredIncome({
    paymentCents: stressPaymentCents,
    propertyTaxMonthlyCents: Math.round(
      (priceCents * input.propertyTaxBps) / 10000 / 12,
    ),
    heatMonthlyCents: input.heatCents,
    condoFeeMonthlyCents: input.condoFeesCents,
    otherDebtsMonthlyCents: input.otherDebtsMonthlyCents,
  });
  const buyable =
    downCents >= minimumDownPaymentCents(priceCents) &&
    insurance.status !== 'priceTooHigh' &&
    insurance.status !== 'downTooSmall';
  return { stressRateBps, stressPaymentCents, required, buyable };
}

const MAX_SEARCH_PRICE_CENTS = 2_000_000_000; // $20M

// The highest price this income qualifies for, with the same down payment
// (the same % of price, or the same dollars), rate and running costs. Null
// when even a small home doesn't pass.
export function maxQualifyingPriceCents(
  input: QualifyingInput,
  annualIncomeCents: number,
): number | null {
  if (annualIncomeCents <= 0) return null;
  const passes = (price: number) => {
    const q = qualifyingAt(input, price);
    return q.buyable && q.required.requiredAnnualCents <= annualIncomeCents;
  };
  let low = 0;
  let high = MAX_SEARCH_PRICE_CENTS;
  if (!passes(100_000_00)) {
    // Fixed-dollar down payments fail the minimum at high prices but can
    // still fail at low ones only through income, so a $100k miss means no.
    return null;
  }
  low = 100_000_00;
  for (let i = 0; i < 50 && high - low > 100_00; i++) {
    const mid = Math.floor((low + high) / 2);
    if (passes(mid)) low = mid;
    else high = mid;
  }
  return Math.floor(low / 1000_00) * 1000_00;
}

// --- The whole plan -----------------------------------------------------

export interface RenewalRow {
  /** Added to today's rate. */
  shockBps: number;
  rateBps: number;
  monthlyPaymentCents: number;
  /** Against today's monthly payment. */
  changeCents: number;
  /** Share of gross monthly income; null without an income. */
  incomePercent: number | null;
}

export interface PlanResult {
  ready: boolean;
  downCents: number;
  minimumDownCents: number;
  insurance: MortgageInsurance;
  payment: PaymentPlan;
  /** What the payments come to per month, whatever the frequency. */
  monthlyPaymentCents: number;
  propertyTaxMonthlyCents: number;
  monthlyTotalCents: number;
  closing: {
    provincialTax: TransferTax;
    municipalTax: TransferTax;
    premiumTaxCents: number;
    otherClosingCents: number;
    totalCents: number;
  };
  schedule: ScheduleRow[];
  baseline: { months: number; interestCents: number; paysOff: boolean };
  /** Without any extras. */
  baselineSchedule: ScheduleRow[];
  /** `paysOff` false: the payment stops covering the interest. */
  withPrepayments: { months: number; interestCents: number; paysOff: boolean };
  term: { interestCents: number; principalCents: number; balanceCents: number };
  renewal: RenewalRow[];
  qualifying: {
    stressRateBps: number;
    stressPaymentCents: number;
    required: RequiredIncome;
    /** Ratios against the income given; null without one. */
    gdsPercent: number | null;
    tdsPercent: number | null;
    maxPriceCents: number | null;
  };
}

const NO_TAX: TransferTax = { taxCents: 0, rebateCents: 0, netCents: 0 };
const RENEWAL_SHOCKS_BPS = [-100, 0, 100, 200, 300];

export function mortgagePlan(input: PlanInput): PlanResult {
  const existing = input.existing;
  const ready = existing
    ? existing.balanceCents > 0
    : input.priceCents > 0 && input.amortizationMonths > 0;
  const downCents = existing
    ? 0
    : downPaymentCents(input.priceCents, input.down);
  const insurance: MortgageInsurance = existing
    ? {
        status: 'notRequired',
        ltvBps:
          input.priceCents > 0
            ? Math.round((existing.balanceCents / input.priceCents) * 10000)
            : 0,
        premiumRateBps: 0,
        premiumCents: 0,
        totalMortgageCents: existing.balanceCents,
      }
    : mortgageInsurance(input.priceCents, downCents, input.amortizationMonths);
  const mortgageCents = insurance.totalMortgageCents;
  const payment = paymentPlan(
    mortgageCents,
    input.rateBps,
    input.amortizationMonths,
    input.frequency,
    input.compounding,
  );
  // Accelerated schedules pay a thirteenth month a year; spread over twelve,
  // so they compare fairly and the schedule shows them finishing early.
  const monthlyPaymentCents =
    existing?.monthlyPaymentCents ?? Math.round(payment.annualOutlayCents / 12);
  const propertyTaxMonthlyCents = Math.round(
    (input.priceCents * input.propertyTaxBps) / 10000 / 12,
  );
  const monthlyTotalCents =
    monthlyPaymentCents +
    propertyTaxMonthlyCents +
    input.condoFeesCents +
    input.heatCents +
    input.otherMonthlyCents -
    input.rentalIncomeCents;

  const rules = existing ? undefined : TRANSFER_TAX_RULES[input.province];
  const provincialTax = rules
    ? transferTax(input.priceCents, rules, input.firstTimeBuyer)
    : NO_TAX;
  const municipalTax =
    !existing && input.toronto && input.province === 'ON'
      ? transferTax(input.priceCents, TORONTO_RULES, input.firstTimeBuyer)
      : NO_TAX;
  const premiumTaxCents = premiumSalesTaxCents(
    insurance.premiumCents,
    input.province,
  );
  const closingTotal = existing
    ? 0
    : downCents +
      provincialTax.netCents +
      municipalTax.netCents +
      premiumTaxCents +
      input.otherClosingCents;

  const baselineRows = monthlySchedule(
    mortgageCents,
    input.rateBps,
    input.compounding,
    monthlyPaymentCents,
  );
  const schedule = monthlySchedule(
    mortgageCents,
    input.rateBps,
    input.compounding,
    monthlyPaymentCents,
    input.prepayments,
  );

  const termRows = schedule.slice(0, input.termMonths);
  const termBalance = balanceAfter(schedule, mortgageCents, input.termMonths);
  const baselinePaysOff = paysOff(baselineRows);
  // A real mortgage runs as long as its payment takes, not a chosen term.
  const amortizationMonths =
    existing && baselinePaysOff
      ? baselineRows.length
      : input.amortizationMonths;
  const remainingMonths = Math.max(1, amortizationMonths - input.termMonths);
  const grossMonthly = input.annualIncomeCents / 12;
  const renewal = RENEWAL_SHOCKS_BPS.filter(
    (shockBps) => input.rateBps + shockBps > 0,
  ).map((shockBps) => {
    const rateBps = input.rateBps + shockBps;
    const monthly =
      termBalance > 0
        ? paymentPlan(
            termBalance,
            rateBps,
            remainingMonths,
            'monthly',
            input.compounding,
          ).paymentCents
        : 0;
    return {
      shockBps,
      rateBps,
      monthlyPaymentCents: monthly,
      changeCents: monthly - monthlyPaymentCents,
      incomePercent: grossMonthly > 0 ? (monthly / grossMonthly) * 100 : null,
    };
  });

  const qualifyingInput: QualifyingInput = {
    priceCents: input.priceCents,
    down: input.down,
    amortizationMonths: input.amortizationMonths,
    rateBps: input.rateBps,
    propertyTaxBps: input.propertyTaxBps,
    heatCents: input.heatCents,
    condoFeesCents: input.condoFeesCents,
    otherDebtsMonthlyCents: input.otherDebtsMonthlyCents,
  };
  const q = qualifyingAt(qualifyingInput, input.priceCents);
  const ratio = (monthly: number) =>
    grossMonthly > 0 ? (monthly / grossMonthly) * 100 : null;

  return {
    ready,
    downCents,
    minimumDownCents: minimumDownPaymentCents(input.priceCents),
    insurance,
    payment,
    monthlyPaymentCents,
    propertyTaxMonthlyCents,
    monthlyTotalCents,
    closing: {
      provincialTax,
      municipalTax,
      premiumTaxCents,
      otherClosingCents: input.otherClosingCents,
      totalCents: closingTotal,
    },
    schedule,
    baselineSchedule: baselineRows,
    baseline: {
      months: baselineRows.length,
      interestCents: interestOf(baselineRows),
      paysOff: baselinePaysOff,
    },
    withPrepayments: {
      months: schedule.length,
      interestCents: interestOf(schedule),
      paysOff: paysOff(schedule),
    },
    term: {
      interestCents: interestOf(termRows),
      principalCents: mortgageCents - termBalance,
      balanceCents: termBalance,
    },
    renewal,
    qualifying: {
      stressRateBps: q.stressRateBps,
      stressPaymentCents: q.stressPaymentCents,
      required: q.required,
      gdsPercent: ratio(q.required.gdsMonthlyCents),
      tdsPercent: ratio(q.required.tdsMonthlyCents),
      // A real mortgage is past qualifying; no price to search for.
      maxPriceCents: existing
        ? null
        : maxQualifyingPriceCents(qualifyingInput, input.annualIncomeCents),
    },
  };
}

// --- Extras by calendar month ------------------------------------------

/** Extras keyed by 'YYYY-MM', so a plan stays on its month as time passes. */
export interface CalendarExtras {
  lumps: Record<string, number>;
  recurring: Record<string, number>;
}

/** 1 for `first` itself, 2 for the month after, 0 or less before it. */
export function monthIndex(first: string, month: string): number {
  const [fy, fm] = first.split('-').map(Number);
  const [y, m] = month.split('-').map(Number);
  return (y - fy) * 12 + (m - fm) + 1;
}

export function monthAt(first: string, index: number): string {
  const [fy, fm] = first.split('-').map(Number);
  const d = new Date(Date.UTC(fy, fm - 1 + index - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Into schedule months counted from `first`. Lumps already behind are gone;
// a recurring amount that started earlier carries on from month 1.
export function extrasFromCalendar(
  extras: CalendarExtras,
  first: string,
): { lumps: Record<number, number>; recurring: Record<number, number> } {
  const lumps: Record<number, number> = {};
  for (const [month, cents] of Object.entries(extras.lumps)) {
    const i = monthIndex(first, month);
    if (i >= 1) lumps[i] = cents;
  }
  const recurring: Record<number, number> = {};
  let carried: [string, number] | null = null;
  for (const [month, cents] of Object.entries(extras.recurring)) {
    const i = monthIndex(first, month);
    if (i >= 1) recurring[i] = cents;
    else if (!carried || month > carried[0]) carried = [month, cents];
  }
  if (carried && recurring[1] == null) recurring[1] = carried[1];
  return { lumps, recurring };
}

// Back to calendar months; entries before `first` are kept as they were.
export function extrasToCalendar(
  scheduled: {
    lumps: Record<number, number>;
    recurring: Record<number, number>;
  },
  first: string,
  previous: CalendarExtras,
): CalendarExtras {
  const before = (map: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(map).filter(([month]) => monthIndex(first, month) < 1),
    );
  const after = (map: Record<number, number>) =>
    Object.fromEntries(
      Object.entries(map).map(([i, cents]) => [
        monthAt(first, Number(i)),
        cents,
      ]),
    );
  return {
    lumps: { ...before(previous.lumps), ...after(scheduled.lumps) },
    recurring: { ...before(previous.recurring), ...after(scheduled.recurring) },
  };
}

// --- Breaking a fixed rate ---------------------------------------------

// What a Canadian lender charges to leave mid-term. Variable: three months'
// interest. Fixed: the greater of that and the interest rate differential —
// the rate drop times the balance over the months left. Lenders measure the
// drop from a discounted posted rate, so theirs is often higher.
export function breakPenaltyCents({
  balanceCents,
  rateBps,
  comparisonRateBps,
  monthsLeftInTerm,
  fixed,
}: {
  balanceCents: number;
  rateBps: number;
  comparisonRateBps: number;
  monthsLeftInTerm: number;
  fixed: boolean;
}): { penaltyCents: number; threeMonthsCents: number; irdCents: number } {
  const threeMonthsCents = Math.round((balanceCents * rateBps) / 10000 / 4);
  const irdCents = fixed
    ? Math.max(
        0,
        Math.round(
          ((balanceCents * (rateBps - comparisonRateBps)) / 10000) *
            (Math.max(0, monthsLeftInTerm) / 12),
        ),
      )
    : 0;
  return {
    penaltyCents: Math.max(threeMonthsCents, irdCents),
    threeMonthsCents,
    irdCents,
  };
}

// --- A held mortgage's own history -------------------------------------

// Months already behind on a real mortgage, from what was actually paid in
// each, worked backwards from what is owed now: each month's interest is
// charged on the balance it started with, so the last row ends exactly on
// today's balance and the schedule ahead carries on from it. A month with
// nothing recorded shows nothing paid and the interest added on.
export function pastRowsFromPayments({
  owedCents,
  paidByMonth,
  fromMonth,
  toMonth,
  rateBpsAt,
  compounding,
}: {
  owedCents: number;
  paidByMonth: Record<string, number>;
  fromMonth: string;
  toMonth: string;
  rateBpsAt: (month: string) => number;
  compounding: Compounding;
}): ScheduleRow[] {
  const count = monthIndex(fromMonth, toMonth);
  const rows: ScheduleRow[] = [];
  let after = owedCents;
  for (let i = count; i >= 1; i--) {
    const month = monthAt(fromMonth, i);
    const rate = periodicRate(rateBpsAt(month), 12, compounding);
    const paid = paidByMonth[month] ?? 0;
    const before = Math.round((after + paid) / (1 + rate));
    const interest = after + paid - before;
    rows.push({
      month: i,
      paymentCents: paid,
      principalCents: paid - interest,
      interestCents: interest,
      extraCents: 0,
      balanceCents: after,
    });
    after = before;
  }
  return rows.reverse();
}

/** The usual monthly payment: the median of recent months' totals. */
export function usualPaymentCents(monthTotals: number[]): number | null {
  const sorted = monthTotals.filter((c) => c > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// The rate at which a fixed payment only covers the interest — past it, a
// variable mortgage stops shrinking.
export function triggerRateBps(
  balanceCents: number,
  monthlyPaymentCents: number,
): number | null {
  if (balanceCents <= 0) return null;
  return Math.round(((monthlyPaymentCents * 12) / balanceCents) * 10000);
}

// Insured mortgages (under 20% down): 25 years, or 30 for a first-time
// buyer or a new build (since 2024-12-15). Uninsured: lenders go to 30.
export function maxAmortizationMonths(
  insured: boolean,
  firstTimeBuyer: boolean,
): number {
  return insured && !firstTimeBuyer ? 300 : 360;
}

/** Term start + length, rolled forward past `today` ('YYYY-MM'). */
export function nextRenewalMonth(
  termStartMonth: string,
  termMonths: number,
  today: string,
): string {
  if (termMonths <= 0) return today;
  let renewal = monthAt(termStartMonth, termMonths + 1);
  while (renewal <= today) renewal = monthAt(renewal, termMonths + 1);
  return renewal;
}

// The smallest extra every month that pays the loan off within
// `targetMonths`; null when the regular payment already does.
export function extraMonthlyToPayOffBy(
  principalCents: number,
  rateBps: number,
  compounding: Compounding,
  monthlyPaymentCents: number,
  targetMonths: number,
): number | null {
  const months = (extra: number) =>
    monthlySchedule(principalCents, rateBps, compounding, monthlyPaymentCents, {
      ...NO_PREPAYMENTS,
      monthlyCents: extra,
    }).length;
  if (targetMonths <= 0) return null;
  if (months(0) <= targetMonths) return null;
  let lo = 0;
  let hi = Math.max(principalCents, 100);
  while (hi - lo > 100) {
    const mid = Math.floor((lo + hi) / 2);
    if (months(mid) <= targetMonths) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 100) * 100;
}
