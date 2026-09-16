import { addMonths, monthlyRateFromBps } from './amortization';
import type { AmortizationPaymentRow } from './amortization';

// 等额本金 — equal principal. The same slice of principal every month, so the
// interest (and with it the payment) falls in a straight line. Standard in
// China alongside 等额本息, and absent from amortization.ts, which only does
// the level-payment kind.
//
// Same row shape as buildAmortizationSchedule so one schedule table renders
// either method.
export function buildEqualPrincipalSchedule(
  principalCents: number,
  annualRateBps: number,
  termMonths: number,
  startDateIso: string,
): AmortizationPaymentRow[] {
  if (principalCents <= 0 || termMonths <= 0) return [];
  const r = monthlyRateFromBps(annualRateBps);
  // Floor, with the last period absorbing the remainder — so the principal
  // columns sum to exactly the loan and the balance lands on 0.
  const perPeriod = Math.floor(principalCents / termMonths);
  const rows: AmortizationPaymentRow[] = [];
  let balance = principalCents;

  for (let period = 1; period <= termMonths; period += 1) {
    const interestCents = Math.round(balance * r);
    const principalPart = period === termMonths ? balance : perPeriod;
    balance -= principalPart;
    rows.push({
      period,
      date: addMonths(startDateIso, period),
      paymentCents: principalPart + interestCents,
      principalCents: principalPart,
      interestCents,
      balanceCents: balance,
    });
  }
  return rows;
}

// 每月递减 — how much smaller each payment is than the one before it, and a
// headline number on Chinese mortgage calculators.
//
// Nominal: the row-to-row difference in the schedule lands a cent either side
// of this, because each period's interest is rounded to whole fen
// independently. Quote this figure, don't derive it by subtracting two rows.
export function equalPrincipalMonthlyDecrementCents(principalCents: number, annualRateBps: number, termMonths: number): number {
  if (principalCents <= 0 || termMonths <= 0) return 0;
  return Math.round(Math.floor(principalCents / termMonths) * monthlyRateFromBps(annualRateBps));
}
