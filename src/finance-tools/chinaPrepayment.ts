import { addMonths, buildAmortizationSchedule, monthlyPaymentCents, remainingMonthsToPayoff } from './amortization';
import type { AmortizationPaymentRow } from './amortization';
import { buildEqualPrincipalSchedule, equalPrincipalMonthlyDecrementCents } from './equalPrincipal';

// 提前还贷 — prepaying a Chinese mortgage. Its own module rather than a mode
// on the payoff calculator because the product is genuinely different:
// borrowers choose a repayment method up front, prepaying forces a choice
// between shortening the term and cutting the payment, and an LPR reset can
// change the rate on the remaining balance at the same moment.
//
// Not modelled, deliberately: 违约金 (prepayment penalties vary by bank and
// contract), and interest accruing between the last installment and the
// prepayment date — the reference calculators leave both out too.

export type RepaymentMethod = 'equalInstallment' | 'equalPrincipal'; // 等额本息 / 等额本金
export type PrepaymentKind = 'partial' | 'full'; // 部分提前还清 / 全部提前还清
export type AdjustmentPlan = 'shortenTerm' | 'reducePayment'; // 缩短年限 / 减少月供

export interface ChinaLoanContract {
  principalCents: number;
  annualRateBps: number;
  termMonths: number;
  method: RepaymentMethod;
  startDateIso: string; // 合同生效
}

export interface PrepaymentInput {
  contract: ChinaLoanContract;
  prepayDateIso: string; // 还款日期
  kind: PrepaymentKind;
  amountCents: number; // 还款金额 — ignored when kind is 'full'
  plan: AdjustmentPlan; // only meaningful for a partial prepayment
  newAnnualRateBps?: number; // 新贷款利率 — LPR repricing; defaults to the contract rate
  newMethod?: RepaymentMethod; // 新还款方式
}

export interface LoanSummary {
  principalCents: number;
  termMonths: number;
  annualRateBps: number;
  method: RepaymentMethod;
  firstPaymentCents: number; // 首月还款
  monthlyDecrementCents: number; // 每月递减 — 0 for 等额本息
  lastPaymentCents: number; // 末月还款
  totalInterestCents: number; // 利息总额
  totalPaymentCents: number; // 本息合计
}

export interface PrepaymentResult {
  paidPeriods: number; // 已还期数
  paidTotalCents: number; // 已还本息
  paidPrincipalCents: number; // 已还本金
  paidInterestCents: number; // 已还利息
  remainingTotalCents: number; // 剩余本息
  remainingPrincipalCents: number; // 剩余本金
  remainingInterestCents: number; // 剩余利息
  prepayAmountCents: number; // 还款金额
  interestSavedCents: number; // 节省利息
  // The same figure with the rate held at the contract's — so a screen can
  // separate what prepaying bought from what an LPR reset bought.
  interestSavedFromPrepaymentCents: number;
  original: LoanSummary | null; // the REMAINING portion of the original contract
  revised: LoanSummary | null; // null once the loan is fully cleared
  revisedSchedule: AmortizationPaymentRow[]; // 月供明细
  error: 'paymentBelowInterest' | null;
}

function buildSchedule(
  method: RepaymentMethod,
  principalCents: number,
  annualRateBps: number,
  termMonths: number,
  startDateIso: string,
): AmortizationPaymentRow[] {
  if (principalCents <= 0 || termMonths <= 0) return [];
  if (method === 'equalPrincipal') return buildEqualPrincipalSchedule(principalCents, annualRateBps, termMonths, startDateIso);
  const payment = monthlyPaymentCents(principalCents, annualRateBps, termMonths);
  return buildAmortizationSchedule(principalCents, annualRateBps, payment, startDateIso, termMonths + 2);
}

function summarize(
  rows: AmortizationPaymentRow[],
  principalCents: number,
  annualRateBps: number,
  termMonths: number,
  method: RepaymentMethod,
): LoanSummary | null {
  if (rows.length === 0) return null;
  const totalInterestCents = rows.reduce((sum, row) => sum + row.interestCents, 0);
  return {
    principalCents,
    termMonths,
    annualRateBps,
    method,
    firstPaymentCents: rows[0].paymentCents,
    monthlyDecrementCents: method === 'equalPrincipal' ? equalPrincipalMonthlyDecrementCents(principalCents, annualRateBps, termMonths) : 0,
    lastPaymentCents: rows[rows.length - 1].paymentCents,
    totalInterestCents,
    totalPaymentCents: rows.reduce((sum, row) => sum + row.paymentCents, 0),
  };
}

// Whole installments already made by the prepayment date. Counts completed
// months only — a prepayment halfway through a month doesn't earn a partial
// period, matching how the reference calculators present it.
function periodsPaidBy(contract: ChinaLoanContract, prepayDateIso: string): number {
  let paid = 0;
  while (paid < contract.termMonths && addMonths(contract.startDateIso, paid + 1) <= prepayDateIso) paid += 1;
  return paid;
}

const EMPTY: PrepaymentResult = {
  paidPeriods: 0,
  paidTotalCents: 0,
  paidPrincipalCents: 0,
  paidInterestCents: 0,
  remainingTotalCents: 0,
  remainingPrincipalCents: 0,
  remainingInterestCents: 0,
  prepayAmountCents: 0,
  interestSavedCents: 0,
  interestSavedFromPrepaymentCents: 0,
  original: null,
  revised: null,
  revisedSchedule: [],
  error: null,
};

export function computePrepayment(input: PrepaymentInput): PrepaymentResult {
  const { contract } = input;
  const baseline = buildSchedule(contract.method, contract.principalCents, contract.annualRateBps, contract.termMonths, contract.startDateIso);
  if (baseline.length === 0) return EMPTY;

  const paidPeriods = periodsPaidBy(contract, input.prepayDateIso);
  const paid = baseline.slice(0, paidPeriods);
  const remaining = baseline.slice(paidPeriods);

  const paidPrincipalCents = paid.reduce((s, r) => s + r.principalCents, 0);
  const paidInterestCents = paid.reduce((s, r) => s + r.interestCents, 0);
  const remainingPrincipalCents = paidPeriods === 0 ? contract.principalCents : baseline[paidPeriods - 1].balanceCents;
  const remainingInterestCents = remaining.reduce((s, r) => s + r.interestCents, 0);

  const base = {
    paidPeriods,
    paidTotalCents: paidPrincipalCents + paidInterestCents,
    paidPrincipalCents,
    paidInterestCents,
    remainingTotalCents: remainingPrincipalCents + remainingInterestCents,
    remainingPrincipalCents,
    remainingInterestCents,
    original: summarize(remaining, remainingPrincipalCents, contract.annualRateBps, contract.termMonths - paidPeriods, contract.method),
  };

  const clearsTheLoan = input.kind === 'full' || input.amountCents >= remainingPrincipalCents;
  if (clearsTheLoan) {
    return {
      ...EMPTY,
      ...base,
      prepayAmountCents: remainingPrincipalCents,
      interestSavedCents: remainingInterestCents,
      interestSavedFromPrepaymentCents: remainingInterestCents,
    };
  }

  const newPrincipalCents = remainingPrincipalCents - input.amountCents;
  const newMethod = input.newMethod ?? contract.method;
  const newRateBps = input.newAnnualRateBps ?? contract.annualRateBps;
  const anchorIso = addMonths(contract.startDateIso, paidPeriods);

  const revisedAtRate = (rateBps: number) => {
    const termMonths = revisedTermMonths(contract, baseline, paidPeriods, newPrincipalCents, newMethod, rateBps, input.plan);
    if (termMonths == null) return null;
    return { termMonths, rows: buildSchedule(newMethod, newPrincipalCents, rateBps, termMonths, anchorIso) };
  };

  const revised = revisedAtRate(newRateBps);
  if (revised == null) {
    return { ...EMPTY, ...base, prepayAmountCents: input.amountCents, error: 'paymentBelowInterest' };
  }

  const revisedInterestCents = revised.rows.reduce((s, r) => s + r.interestCents, 0);
  const atOldRate = newRateBps === contract.annualRateBps ? revised : revisedAtRate(contract.annualRateBps);
  const interestAtOldRate = atOldRate ? atOldRate.rows.reduce((s, r) => s + r.interestCents, 0) : revisedInterestCents;

  return {
    ...base,
    prepayAmountCents: input.amountCents,
    // Baseline is the original contract's interest *from the prepayment date
    // onward* — not its whole-life interest, which would credit the
    // prepayment with everything already paid.
    interestSavedCents: remainingInterestCents - revisedInterestCents,
    interestSavedFromPrepaymentCents: remainingInterestCents - interestAtOldRate,
    revised: summarize(revised.rows, newPrincipalCents, newRateBps, revised.termMonths, newMethod),
    revisedSchedule: revised.rows,
    error: null,
  };
}

// 缩短年限 keeps what you pay each month and asks how long that takes;
// 期限不变 keeps the remaining term and asks what it now costs per month.
// Returns null when the retained payment can't even cover the new interest.
function revisedTermMonths(
  contract: ChinaLoanContract,
  baseline: AmortizationPaymentRow[],
  paidPeriods: number,
  newPrincipalCents: number,
  newMethod: RepaymentMethod,
  newRateBps: number,
  plan: AdjustmentPlan,
): number | null {
  if (plan === 'reducePayment') return contract.termMonths - paidPeriods;

  if (newMethod === 'equalPrincipal') {
    // 等额本金 has no constant payment to hold — what's kept is the principal
    // slice, which is what makes the payment fall at the same rate as before.
    const perPeriod = Math.floor(contract.principalCents / contract.termMonths);
    return perPeriod > 0 ? Math.ceil(newPrincipalCents / perPeriod) : null;
  }

  // The payment being retained is whatever was due next under the old
  // contract — constant for 等额本息, and the next declining installment when
  // switching away from 等额本金.
  //
  // The new term has to be a whole number of months, so the payment that
  // comes back out of it is near the retained one but not equal to it. That
  // is what 月供"基本"不变 means — roughly unchanged, not identical; rounding
  // the term up lands the payment slightly under.
  const retainedPaymentCents = baseline[Math.min(paidPeriods, baseline.length - 1)].paymentCents;
  const months = remainingMonthsToPayoff(newPrincipalCents, newRateBps, retainedPaymentCents);
  return Number.isFinite(months) ? months : null;
}
