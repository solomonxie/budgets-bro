// What each payment a user ACTUALLY made went to: interest first, the rest
// off the principal. The sibling of amortization.ts — that one projects a
// schedule from the contract's terms, this one reads real, already-posted
// payments (irregular amounts, irregular dates, a skipped month, two in one
// month) and derives the balance that really remains.
//
// Pure, so the balance stays derived rather than stored: fix a rate or a
// payment date and every split recomputes, no migration and no drift.

import { monthlyRateFromBps } from './amortization';

export interface ActualPayment {
  date: string; // 'YYYY-MM-DD'
  // Positive = reduces the debt. A negative amount (a draw, a correction
  // that finds more owed) moves the balance with no interest split.
  amountCents: number;
}

export interface SplitPaymentRow extends ActualPayment {
  interestCents: number;
  principalCents: number;
  owedCents: number; // still owed after this payment
}

export interface PaymentSplitResult {
  rows: SplitPaymentRow[]; // chronological
  owedCents: number;
  interestPaidCents: number;
  principalPaidCents: number;
}

// Whole months from one date to another — a payment on the 1st of three
// months later has accrued three months of interest, one on the same day
// none. Unlike a day count this matches how a monthly installment is
// actually billed.
export function wholeMonthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  if ([fy, fm, fd, ty, tm, td].some(Number.isNaN)) return 0;
  const months = (ty - fy) * 12 + (tm - fm);
  return Math.max(0, td < fd ? months - 1 : months);
}

export function splitActualPayments({
  openingOwedCents,
  annualRateBps,
  startDate,
  payments,
}: {
  openingOwedCents: number; // positive amount owed at startDate
  annualRateBps: number;
  startDate: string; // when interest starts accruing — origination, or when tracking began
  payments: ActualPayment[];
}): PaymentSplitResult {
  const monthlyRate = monthlyRateFromBps(annualRateBps);
  const chronological = [...payments].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let owed = Math.max(0, openingOwedCents);
  let previousDate = startDate;
  let interestPaidCents = 0;
  let principalPaidCents = 0;

  const rows = chronological.map((payment) => {
    // Interest compounds over a gap with no payment in it: an unpaid
    // month's interest is owed the next month too.
    let accrued = 0;
    for (let month = wholeMonthsBetween(previousDate, payment.date); month > 0; month--) {
      const monthInterest = Math.round((owed + accrued) * monthlyRate);
      accrued += monthInterest;
    }
    previousDate = payment.date;

    if (payment.amountCents <= 0) {
      // Not a payment — a draw or a correction. It moves what is owed and
      // carries whatever interest accrued in the gap.
      owed = Math.max(0, owed + accrued - payment.amountCents);
      return { ...payment, interestCents: 0, principalCents: payment.amountCents, owedCents: owed };
    }

    const interestCents = Math.min(accrued, payment.amountCents);
    // Capped at what is left, so a final overpayment shows the payoff
    // amount rather than a negative balance.
    const principalCents = Math.min(payment.amountCents - interestCents, owed + accrued - interestCents);
    owed = Math.max(0, owed + accrued - interestCents - principalCents);
    interestPaidCents += interestCents;
    principalPaidCents += principalCents;
    return { ...payment, interestCents, principalCents, owedCents: owed };
  });

  return { rows, owedCents: owed, interestPaidCents, principalPaidCents };
}
