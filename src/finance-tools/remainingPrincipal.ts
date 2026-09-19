// What a loan still owes, derived — never summed from the ledger and never
// stored.
//
// Transactions stay exactly what the bank statement shows: one real payment,
// its full amount, no principal/interest legs. Splitting a payment into two
// transactions is messy to enter and wrong the moment a rate or a date is
// corrected, so the split happens here at read time instead.
//
// Two inputs: the most recent principal the user logged (ground truth — a
// statement figure), and every payment posted since it. Each payment covers
// that period's interest first and only the remainder comes off the
// principal, so the number drifts toward the truth between readings rather
// than plummeting by the full payment. Logging a new reading re-anchors
// everything after it.

import { splitActualPayments, wholeMonthsBetween } from './paymentSplit';
import { scheduledBalanceCents } from './amortization';
import type { ActualPayment, SplitPaymentRow } from './paymentSplit';

export interface RemainingPrincipal {
  owedCents: number; // positive amount still owed
  // Payment-by-payment breakdown since the anchor, so the UI can show what
  // the last payment actually bought without splitting the sum a second way.
  rows: SplitPaymentRow[];
  interestPaidCents: number;
  principalPaidCents: number;
  anchorOwedCents: number;
  anchorDate: string;
  // false when no principal has ever been logged and the loan's own terms
  // (amount borrowed at origination, or the opening balance) stood in.
  anchorWasLogged: boolean;
  // Set when the payments on file couldn't explain the gap and the
  // contract's own schedule answered instead — see the ceiling below.
  cappedToSchedule: boolean;
  paymentsSinceAnchor: number;
  // Interest can only be split out with a rate. Without one every payment
  // counts as pure principal, which is right for a 0% lease and openly
  // optimistic for anything else — the UI says so.
  splitInterest: boolean;
}

export function remainingPrincipal({
  loggedPrincipal,
  originalPrincipalCents,
  originationDate,
  openingBalanceCents,
  fallbackDate,
  annualRateBps,
  termMonths,
  asOfDate,
  payments,
}: {
  loggedPrincipal: { valueCents: number; effectiveDate: string } | null;
  originalPrincipalCents: number | null;
  originationDate: string | null;
  openingBalanceCents: number;
  fallbackDate: string;
  annualRateBps: number | null;
  termMonths: number | null;
  // The day being asked about — today for the account itself, the end of the
  // month for a point on the net worth line. Only the ceiling needs it.
  asOfDate: string;
  payments: ActualPayment[];
}): RemainingPrincipal {
  const anchor = loggedPrincipal
    ? { owedCents: loggedPrincipal.valueCents, date: loggedPrincipal.effectiveDate, logged: true }
    : originalPrincipalCents != null && originationDate != null
      ? { owedCents: originalPrincipalCents, date: originationDate, logged: false }
      : { owedCents: -openingBalanceCents, date: originationDate ?? fallbackDate, logged: false };

  // A payment dated on the reading itself is already inside that reading.
  const since = payments.filter((p) => p.date > anchor.date);

  const split = splitActualPayments({
    openingOwedCents: anchor.owedCents,
    annualRateBps: annualRateBps ?? 0,
    startDate: anchor.date,
    payments: since,
  });
  // A loan nobody has ever logged a statement for cannot be worth more than
  // its own contract. Interest compounds across every gap between payments,
  // and a ledger that starts years after the mortgage did has no payments in
  // those years — so an untouched principal walked a decade of interest and
  // a half-paid mortgage came out at three times what was borrowed, which is
  // what dragged the early years of the net worth line below zero. With
  // nothing logged, the scheduled balance is the ceiling, or failing a term,
  // the amount borrowed: a mortgage does not grow.
  //
  // A logged reading is ground truth and is never capped — the payments
  // after it are real and recent, and today's figure has to stay the one the
  // statement says. Nor is a balance someone has drawn on: a line of credit
  // is meant to grow, and a draw on file is evidence, not a gap in it.
  const drawnOn = since.some((p) => p.amountCents <= 0);
  const ceilingCents =
    anchor.logged || drawnOn
      ? null
      : termMonths != null && termMonths > 0
        ? scheduledBalanceCents(
            anchor.owedCents,
            annualRateBps ?? 0,
            termMonths,
            wholeMonthsBetween(anchor.date, asOfDate),
          )
        : anchor.owedCents;
  const owedCents = ceilingCents != null ? Math.min(split.owedCents, ceilingCents) : split.owedCents;

  return {
    owedCents,
    cappedToSchedule: ceilingCents != null && ceilingCents < split.owedCents,
    rows: split.rows,
    interestPaidCents: split.interestPaidCents,
    principalPaidCents: split.principalPaidCents,
    anchorOwedCents: anchor.owedCents,
    anchorDate: anchor.date,
    anchorWasLogged: anchor.logged,
    paymentsSinceAnchor: since.length,
    splitInterest: annualRateBps != null && annualRateBps > 0,
  };
}
