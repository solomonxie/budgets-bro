import { monthlyPaymentCents, remainingMonthsToPayoff, totalInterestRemainingCents } from './amortization';

// Replacing one loan with another. The question is never "is the new rate
// lower" — it's whether the closing costs come back before you move or
// refinance again, which is why break-even is the headline and not the rate.
export interface RefinanceInput {
  balanceCents: number;
  currentRateBps: number;
  currentRemainingMonths: number;
  newRateBps: number;
  newTermMonths: number;
  closingCostsCents: number;
  // Financed instead of paid at closing — nothing out of pocket, but the
  // costs then carry interest for the whole new term.
  rollCostsIntoLoan: boolean;
}

export interface RefinanceResult {
  currentPaymentCents: number;
  newPaymentCents: number;
  newLoanCents: number;
  cashAtClosingCents: number;
  monthlySavingCents: number;
  // null when the new payment is no lower — there's nothing to pay the
  // closing costs back with, so a month count would be a made-up number.
  breakEvenMonths: number | null;
  currentTotalInterestCents: number;
  newTotalInterestCents: number;
  lifetimeInterestSavedCents: number;
}

export function compareRefinance(input: RefinanceInput): RefinanceResult {
  const currentPaymentCents = monthlyPaymentCents(input.balanceCents, input.currentRateBps, input.currentRemainingMonths);
  const newLoanCents = input.balanceCents + (input.rollCostsIntoLoan ? input.closingCostsCents : 0);
  const newPaymentCents = monthlyPaymentCents(newLoanCents, input.newRateBps, input.newTermMonths);
  const cashAtClosingCents = input.rollCostsIntoLoan ? 0 : input.closingCostsCents;
  const monthlySavingCents = currentPaymentCents - newPaymentCents;

  const currentTotalInterestCents = totalInterestRemainingCents(
    input.balanceCents,
    currentPaymentCents,
    input.currentRemainingMonths,
  );
  const newTotalInterestCents = totalInterestRemainingCents(newLoanCents, newPaymentCents, input.newTermMonths);

  return {
    currentPaymentCents,
    newPaymentCents,
    newLoanCents,
    cashAtClosingCents,
    monthlySavingCents,
    // Measured against what you actually hand over at closing: rolling the
    // costs in makes that zero, and the price of that shows up in
    // `lifetimeInterestSavedCents` instead, where it belongs.
    breakEvenMonths:
      monthlySavingCents > 0 ? Math.ceil(cashAtClosingCents / monthlySavingCents) : null,
    currentTotalInterestCents,
    // Costs paid at closing aren't interest, but they're money the
    // refinance costs you — netting them here keeps this figure answering
    // "am I ahead over the life of the loan".
    newTotalInterestCents,
    lifetimeInterestSavedCents: currentTotalInterestCents - newTotalInterestCents - cashAtClosingCents,
  };
}

// The other shape of the question: keep paying what you pay now, at the new
// rate. Every cent of the lower payment goes to principal instead of into
// your month, which is usually the version worth taking.
export function payoffMonthsAtCurrentPayment(input: RefinanceInput): number {
  const currentPaymentCents = monthlyPaymentCents(input.balanceCents, input.currentRateBps, input.currentRemainingMonths);
  const newLoanCents = input.balanceCents + (input.rollCostsIntoLoan ? input.closingCostsCents : 0);
  return remainingMonthsToPayoff(newLoanCents, input.newRateBps, currentPaymentCents);
}
