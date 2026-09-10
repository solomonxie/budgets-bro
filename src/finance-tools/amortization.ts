// Standard fixed-rate amortization math. Pure functions, no DB/React
// dependency — used by both the mortgage/loan account detail card and any
// standalone calculator screen.

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
