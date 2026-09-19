// Standard fixed-rate amortization math. Pure functions, no DB/React
// dependency — used by both the mortgage/loan account detail card and any
// standalone calculator screen. `remainingMonthsToPayoff`/
// `totalInterestRemainingCents` take the total monthly payment, so an
// extra/early payment is just added to the scheduled payment by the caller
// (see LoanDetailsCard) — no separate "extra payment" function needed.

export function monthlyRateFromBps(annualRateBps: number): number {
  return annualRateBps / 10000 / 12;
}

export function monthlyPaymentCents(principalCents: number, annualRateBps: number, termMonths: number): number {
  if (termMonths <= 0) return principalCents;
  const r = monthlyRateFromBps(annualRateBps);
  if (r === 0) return Math.round(principalCents / termMonths);
  const factor = Math.pow(1 + r, termMonths);
  return Math.round((principalCents * r * factor) / (factor - 1));
}

// What the contract says is still owed `monthsElapsed` installments in — the
// balance of a loan paid exactly on schedule, never touched by the ledger.
// Stands in wherever the real payments are unknown: a mortgage taken out
// years before the board's first transaction has no payments on file for
// those years, and it did not sit there compounding.
export function scheduledBalanceCents(
  principalCents: number,
  annualRateBps: number,
  termMonths: number,
  monthsElapsed: number,
): number {
  if (termMonths <= 0 || monthsElapsed <= 0) return principalCents;
  if (monthsElapsed >= termMonths) return 0;
  const payment = monthlyPaymentCents(principalCents, annualRateBps, termMonths);
  const r = monthlyRateFromBps(annualRateBps);
  if (r === 0) return Math.max(0, principalCents - payment * monthsElapsed);
  const growth = Math.pow(1 + r, monthsElapsed);
  return Math.max(0, Math.round(principalCents * growth - (payment * (growth - 1)) / r));
}

// Months to pay off `balanceCents` at `paymentCents`/month, or Infinity if
// the payment doesn't even cover the interest accruing each month.
export function remainingMonthsToPayoff(balanceCents: number, annualRateBps: number, paymentCents: number): number {
  if (balanceCents <= 0) return 0;
  const r = monthlyRateFromBps(annualRateBps);
  if (r === 0) return Math.ceil(balanceCents / paymentCents);
  const interestPortion = balanceCents * r;
  if (paymentCents <= interestPortion) return Infinity;
  const months = -Math.log(1 - interestPortion / paymentCents) / Math.log(1 + r);
  return Math.ceil(months);
}

export function totalInterestRemainingCents(balanceCents: number, paymentCents: number, months: number): number {
  if (!Number.isFinite(months)) return Infinity;
  return Math.max(0, Math.round(paymentCents * months - balanceCents));
}

export function addMonths(dateIso: string, months: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

export interface AmortizationPaymentRow {
  period: number;
  date: string;
  paymentCents: number;
  principalCents: number;
  interestCents: number;
  balanceCents: number;
}

// Payment-by-payment principal/interest breakdown and running balance —
// the "amortization schedule" table. Caller supplies `paymentCents`
// (either `monthlyPaymentCents`'s result, or that plus an extra/early
// payment), so this one function backs both an ad-hoc calculator and a
// real account's actual projection. Stops early if the payment doesn't
// even cover accruing interest (mirrors `remainingMonthsToPayoff`'s
// Infinity case) rather than looping forever; `maxPeriods` is a second
// backstop for the same reason.
export function buildAmortizationSchedule(
  balanceCents: number,
  annualRateBps: number,
  paymentCents: number,
  startDateIso: string,
  maxPeriods = 600,
): AmortizationPaymentRow[] {
  const r = monthlyRateFromBps(annualRateBps);
  const rows: AmortizationPaymentRow[] = [];
  let balance = balanceCents;
  for (let period = 1; balance > 0 && period <= maxPeriods; period++) {
    const interestCents = Math.round(balance * r);
    if (paymentCents <= interestCents) break;
    const principalCents = Math.min(paymentCents - interestCents, balance);
    balance -= principalCents;
    rows.push({
      period,
      date: addMonths(startDateIso, period),
      paymentCents: principalCents + interestCents,
      principalCents,
      interestCents,
      balanceCents: balance,
    });
  }
  return rows;
}
