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

import { splitActualPayments } from './paymentSplit';
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
  payments,
}: {
  loggedPrincipal: { valueCents: number; effectiveDate: string } | null;
  originalPrincipalCents: number | null;
  originationDate: string | null;
  openingBalanceCents: number;
  fallbackDate: string;
  annualRateBps: number | null;
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
  return {
    owedCents: split.owedCents,
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
