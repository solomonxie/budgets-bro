import { remainingPrincipal } from '../finance-tools/remainingPrincipal';
import { scheduledBalanceCents } from '../finance-tools/amortization';
import { wholeMonthsBetween } from '../finance-tools/paymentSplit';
import { lastDateOfMonth } from './month';
import type { GrowthPoint } from './investmentGrowth';

export interface DatedReading {
  valueCents: number;
  effectiveDate: string; // 'YYYY-MM-DD'
}

export interface DatedPayment {
  date: string; // 'YYYY-MM-DD'
  amountCents: number; // positive pays the debt down
}

// What the loan says about itself, independent of anything logged since.
export interface LoanTerms {
  originalPrincipalCents: number | null;
  originationDate: string | null;
  termMonths: number | null;
  openingBalanceCents: number;
  // Stands in for an origination date nobody filled in.
  fallbackDate: string;
}

function latestOnOrBefore(
  readings: DatedReading[],
  month: string,
  asOfDate: string,
): DatedReading | null {
  let found: DatedReading | null = null;
  for (const r of readings) {
    if (r.effectiveDate.slice(0, 7) > month) continue;
    if (r.effectiveDate > asOfDate) continue;
    if (!found || r.effectiveDate > found.effectiveDate) found = r;
  }
  return found;
}

function earliest(readings: DatedReading[]): DatedReading | null {
  let found: DatedReading | null = null;
  for (const r of readings) {
    if (!found || r.effectiveDate < found.effectiveDate) found = r;
  }
  return found;
}

// The balance the contract's own schedule is at on a given day — what is
// left of the loan if it has been paid exactly as agreed. Null unless the
// terms are all on file.
function scheduledOwedCents(
  terms: LoanTerms,
  annualRateBps: number | null,
  onDate: string,
): number | null {
  const { originalPrincipalCents, originationDate, termMonths } = terms;
  if (originalPrincipalCents == null || originationDate == null) return null;
  if (termMonths == null || termMonths <= 0) return null;
  return scheduledBalanceCents(
    originalPrincipalCents,
    annualRateBps ?? 0,
    termMonths,
    wholeMonthsBetween(originationDate, onDate),
  );
}

// What a loan still owes at the end of one month — the single rule the net
// worth line, the accounts list and the mortgage's own chart all read.
//
// In order of what it trusts:
//
// - the last statement logged on or before that month, walked forward
//   through the payments posted since it. Each payment covers its period's
//   interest first, so the balance falls by rather less than the payment;
// - failing that, the contract's own schedule from the origination, which
//   is what says a loan taken out in 2006 was mostly paid off by 2024 even
//   when none of those payments are on file. A mortgage exists, and is
//   being paid down, from the day it was signed — not from the day someone
//   first typed a figure into this app;
// - failing even that (no term on file), the oldest statement carried back,
//   then the amount borrowed.
//
// What it never does is compound an untouched principal forward from the
// origination across years the ledger knows nothing about: that turned a
// half-paid mortgage into three times what was borrowed.
export function owedAtMonth({
  month,
  terms,
  principalReadings,
  payments,
  annualRateBps,
  asOfDate,
}: {
  month: string; // 'YYYY-MM'
  terms: LoanTerms;
  principalReadings: DatedReading[];
  payments: DatedPayment[];
  annualRateBps: number | null;
  asOfDate: string; // today, so the month we stand in stops where the present does
}): number {
  const monthEnd = lastDateOfMonth(month);
  const asOfMonth = monthEnd < asOfDate ? monthEnd : asOfDate;
  const logged = latestOnOrBefore(principalReadings, month, asOfDate);

  if (logged) {
    return remainingPrincipal({
      loggedPrincipal: logged,
      originalPrincipalCents: terms.originalPrincipalCents,
      originationDate: terms.originationDate,
      openingBalanceCents: terms.openingBalanceCents,
      fallbackDate: terms.fallbackDate,
      annualRateBps,
      termMonths: terms.termMonths,
      asOfDate: asOfMonth,
      payments: payments.filter((p) => p.date <= asOfMonth),
    }).owedCents;
  }

  const scheduled = scheduledOwedCents(terms, annualRateBps, monthEnd);
  if (scheduled != null) return scheduled;
  return (
    earliest(principalReadings)?.valueCents ??
    terms.originalPrincipalCents ??
    -terms.openingBalanceCents
  );
}

// A mortgage's two halves, month by month: what is still owed, and the
// equity standing on top of it. On the day the keys change hands the equity
// is the down payment and the debt is the whole loan; every payment after
// that moves a little from one to the other, and a revaluation moves the
// top of the stack.
//
// Returned as GrowthPoints so it drops straight into the stacked chart the
// investment accounts use: `depositedCents` is the debt (the base band),
// `gainCents` the equity above it, `totalCents` their sum — what the home
// is worth.
export function buildEquitySeries({
  months,
  valueReadings,
  principalReadings,
  payments,
  terms,
  originalHousePriceCents,
  annualRateBps,
  asOfDate,
}: {
  months: string[]; // ascending 'YYYY-MM', from the month the loan began
  valueReadings: DatedReading[];
  principalReadings: DatedReading[];
  payments: DatedPayment[];
  terms: LoanTerms;
  // What the home cost, standing in for the months before anyone valued it
  // by hand — the alternative is a debt with no house against it.
  originalHousePriceCents: number | null;
  annualRateBps: number | null;
  asOfDate: string;
}): GrowthPoint[] {
  const oldestValue = earliest(valueReadings)?.valueCents ?? null;
  return months.map((month) => {
    const owedCents = owedAtMonth({
      month,
      terms,
      principalReadings,
      payments,
      annualRateBps,
      asOfDate,
    });
    const valueCents =
      latestOnOrBefore(valueReadings, month, asOfDate)?.valueCents ??
      originalHousePriceCents ??
      oldestValue ??
      owedCents;
    return {
      date: `${month}-01`,
      totalCents: valueCents,
      depositedCents: owedCents,
      gainCents: valueCents - owedCents,
    };
  });
}
