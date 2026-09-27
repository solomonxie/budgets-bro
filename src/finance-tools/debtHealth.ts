import { monthlyPaymentCents } from './amortization';
import { stressTestRateBps } from './canadianMortgage';

// How heavy a loan payment sits on take-home pay. Take-home, not gross: it is
// what the ledger sees arrive, and what the payment actually comes out of.

export type DebtHealthLevel = 'healthy' | 'stretched' | 'atRisk';

export interface PaymentRule {
  // At or under: healthy. Over `stretchedMaxPercent`: at risk.
  healthyMaxPercent: number;
  stretchedMaxPercent: number;
}

// Ramsey: a mortgage payment no more than 25% of take-home pay.
export const MORTGAGE_RULE: PaymentRule = { healthyMaxPercent: 25, stretchedMaxPercent: 35 };
// 20/4/10: a car costs no more than 10% of income a month. Ramsey's own
// answer for a car is 0% — pay cash.
export const CAR_LOAN_RULE: PaymentRule = { healthyMaxPercent: 10, stretchedMaxPercent: 15 };

// Ramsey's other mortgage rule: a 15-year fixed term.
export const RAMSEY_MAX_TERM_MONTHS = 180;

export const RATE_SHOCKS_BPS = [100, 200, 300];

export function paymentSharePercent(paymentCents: number, monthlyIncomeCents: number): number | null {
  if (monthlyIncomeCents <= 0) return null;
  return (paymentCents / monthlyIncomeCents) * 100;
}

export function healthLevel(percent: number, rule: PaymentRule): DebtHealthLevel {
  if (percent <= rule.healthyMaxPercent) return 'healthy';
  if (percent <= rule.stretchedMaxPercent) return 'stretched';
  return 'atRisk';
}

export interface RepricedPayment {
  rateBps: number;
  paymentCents: number;
  percent: number | null;
  level: DebtHealthLevel | null;
}

export interface LoanState {
  owedCents: number;
  rateBps: number;
  remainingMonths: number;
  monthlyIncomeCents: number;
}

// The same balance, re-amortized over the months left at another rate — what
// a renewal at that rate would ask for.
export function repricedPayment(loan: LoanState, rateBps: number, rule: PaymentRule): RepricedPayment | null {
  if (!Number.isFinite(loan.remainingMonths) || loan.remainingMonths <= 0 || loan.owedCents <= 0) return null;
  const paymentCents = monthlyPaymentCents(loan.owedCents, rateBps, Math.round(loan.remainingMonths));
  const percent = paymentSharePercent(paymentCents, loan.monthlyIncomeCents);
  return { rateBps, paymentCents, percent, level: percent == null ? null : healthLevel(percent, rule) };
}

export function stressTest(loan: LoanState, rule: PaymentRule): RepricedPayment | null {
  return repricedPayment(loan, stressTestRateBps(loan.rateBps), rule);
}

export function rateShocks(loan: LoanState, rule: PaymentRule): RepricedPayment[] {
  return RATE_SHOCKS_BPS.map((add) => repricedPayment(loan, loan.rateBps + add, rule)).filter(
    (r): r is RepricedPayment => r != null,
  );
}

// Share of this month's payment that is interest.
export function interestSharePercent(owedCents: number, rateBps: number, paymentCents: number): number | null {
  if (paymentCents <= 0) return null;
  const interestCents = (owedCents * rateBps) / 10000 / 12;
  return Math.min(100, (interestCents / paymentCents) * 100);
}

export function loanToValuePercent(owedCents: number, valueCents: number | null): number | null {
  if (valueCents == null || valueCents <= 0) return null;
  return (owedCents / valueCents) * 100;
}
