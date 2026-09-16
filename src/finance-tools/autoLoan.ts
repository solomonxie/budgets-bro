import { monthlyPaymentCents } from './amortization';

// A car loan is an ordinary amortizing loan — what makes it its own
// calculator is everything that happens before the principal is known: sales
// tax, dealer fees, and a trade-in that can be worth less than it still owes.
export interface AutoLoanInput {
  priceCents: number;
  downPaymentCents: number;
  tradeInValueCents: number;
  amountOwedOnTradeCents: number;
  salesTaxBps: number;
  // Most US states tax (price − trade-in); a few tax the full price. Worth
  // hundreds either way, so it's a question, not an assumption.
  tradeInReducesTaxableAmount: boolean;
  // Title, registration, documentation — quoted as one flat sum, and always
  // financed rather than paid separately.
  feesCents: number;
  annualRateBps: number;
  termMonths: number;
}

export interface AutoLoanResult {
  // Negative when the trade-in still owes more than it's worth: the shortfall
  // rolls into the new loan rather than being written off.
  tradeInEquityCents: number;
  taxableCents: number;
  salesTaxCents: number;
  amountFinancedCents: number;
  monthlyPaymentCents: number;
  totalOfPaymentsCents: number;
  totalInterestCents: number;
  // Everything the car costs you: the loan's payments plus what you handed
  // over up front.
  totalCostCents: number;
}

export function computeAutoLoan(input: AutoLoanInput): AutoLoanResult {
  const tradeInEquityCents = input.tradeInValueCents - input.amountOwedOnTradeCents;
  const taxableCents = input.tradeInReducesTaxableAmount
    ? Math.max(0, input.priceCents - input.tradeInValueCents)
    : input.priceCents;
  const salesTaxCents = Math.round((taxableCents * input.salesTaxBps) / 10000);
  const amountFinancedCents = Math.max(
    0,
    input.priceCents + salesTaxCents + input.feesCents - input.downPaymentCents - tradeInEquityCents,
  );
  const payment = monthlyPaymentCents(amountFinancedCents, input.annualRateBps, input.termMonths);
  const totalOfPaymentsCents = payment * Math.max(0, input.termMonths);

  return {
    tradeInEquityCents,
    taxableCents,
    salesTaxCents,
    amountFinancedCents,
    monthlyPaymentCents: payment,
    totalOfPaymentsCents,
    totalInterestCents: Math.max(0, totalOfPaymentsCents - amountFinancedCents),
    totalCostCents: totalOfPaymentsCents + input.downPaymentCents,
  };
}
