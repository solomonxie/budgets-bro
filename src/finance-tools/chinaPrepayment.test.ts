import { computePrepayment } from './chinaPrepayment';
import type { ChinaLoanContract, PrepaymentInput } from './chinaPrepayment';

// 100万元 at 3.5% over 30 years, taken out 2020-01-01 — an ordinary
// commercial mortgage. Prepaying 20万元 on 2026-01-01, six years in.
const CONTRACT: ChinaLoanContract = {
  principalCents: 100_000_000,
  annualRateBps: 350,
  termMonths: 360,
  method: 'equalInstallment',
  startDateIso: '2020-01-01',
};

const PARTIAL: PrepaymentInput = {
  contract: CONTRACT,
  prepayDateIso: '2026-01-01',
  kind: 'partial',
  amountCents: 20_000_000,
  plan: 'shortenTerm',
};

describe('computePrepayment — 已还/剩余 split', () => {
  const result = computePrepayment(PARTIAL);

  it('counts only whole installments made by the prepayment date', () => {
    expect(result.paidPeriods).toBe(72); // six years
  });

  it('splits what has been paid into principal and interest', () => {
    expect(result.paidPrincipalCents + result.paidInterestCents).toBe(result.paidTotalCents);
    expect(result.paidPrincipalCents).toBeGreaterThan(0);
    // Early in a 等额本息 loan, most of each payment is interest.
    expect(result.paidInterestCents).toBeGreaterThan(result.paidPrincipalCents);
  });

  it('reconciles paid principal against the outstanding balance', () => {
    expect(result.paidPrincipalCents + result.remainingPrincipalCents).toBe(CONTRACT.principalCents);
    expect(result.remainingTotalCents).toBe(result.remainingPrincipalCents + result.remainingInterestCents);
  });

  it('describes the remaining portion of the old contract, not the whole of it', () => {
    expect(result.original?.principalCents).toBe(result.remainingPrincipalCents);
    expect(result.original?.termMonths).toBe(360 - 72);
  });
});

describe('computePrepayment — 部分提前还清', () => {
  it('shortens the term while holding the payment (缩短年限)', () => {
    const result = computePrepayment(PARTIAL);
    expect(result.revised).not.toBeNull();
    expect(result.revised!.termMonths).toBeLessThan(360 - 72);
    // 月供"基本"不变 — roughly unchanged, not identical. The term is a whole
    // number of months, so rounding it up leaves the payment a hair under.
    const drift = (result.original!.firstPaymentCents - result.revised!.firstPaymentCents) / result.original!.firstPaymentCents;
    expect(drift).toBeGreaterThanOrEqual(0);
    expect(drift).toBeLessThan(0.01);
    expect(result.interestSavedCents).toBeGreaterThan(0);
  });

  it('cuts the payment while holding the term (期限不变)', () => {
    const result = computePrepayment({ ...PARTIAL, plan: 'reducePayment' });
    expect(result.revised!.termMonths).toBe(360 - 72);
    expect(result.revised!.firstPaymentCents).toBeLessThan(result.original!.firstPaymentCents);
    expect(result.interestSavedCents).toBeGreaterThan(0);
  });

  it('saves more interest by shortening the term than by cutting the payment', () => {
    // The standard advice, and the reason the choice is offered at all.
    const shorter = computePrepayment(PARTIAL).interestSavedCents;
    const cheaper = computePrepayment({ ...PARTIAL, plan: 'reducePayment' }).interestSavedCents;
    expect(shorter).toBeGreaterThan(cheaper);
  });

  it('starts the revised schedule on the contract payment day, not the prepayment date', () => {
    const result = computePrepayment(PARTIAL);
    expect(result.revisedSchedule[0].date).toBe('2026-02-01');
  });

  it('repays exactly the reduced principal', () => {
    const result = computePrepayment(PARTIAL);
    const repaid = result.revisedSchedule.reduce((s, r) => s + r.principalCents, 0);
    expect(repaid).toBe(result.remainingPrincipalCents - result.prepayAmountCents);
    expect(result.revisedSchedule.at(-1)?.balanceCents).toBe(0);
  });
});

describe('computePrepayment — 等额本金', () => {
  const equalPrincipal: ChinaLoanContract = { ...CONTRACT, method: 'equalPrincipal' };

  it('reports a monthly decrement for the old contract and none for a level-payment one', () => {
    const declining = computePrepayment({ ...PARTIAL, contract: equalPrincipal });
    expect(declining.original!.monthlyDecrementCents).toBeGreaterThan(0);
    expect(computePrepayment(PARTIAL).original!.monthlyDecrementCents).toBe(0);
  });

  it('holds the principal slice rather than the payment when shortening the term', () => {
    const result = computePrepayment({ ...PARTIAL, contract: equalPrincipal });
    const perPeriod = Math.floor(equalPrincipal.principalCents / equalPrincipal.termMonths);
    expect(result.revised!.termMonths).toBe(Math.ceil((result.remainingPrincipalCents - 20_000_000) / perPeriod));
  });

  it('costs less interest overall than the level-payment method on the same contract', () => {
    const declining = computePrepayment({ ...PARTIAL, contract: equalPrincipal });
    expect(declining.remainingInterestCents).toBeLessThan(computePrepayment(PARTIAL).remainingInterestCents);
  });

  it('can switch method at the same time as prepaying', () => {
    const result = computePrepayment({ ...PARTIAL, newMethod: 'equalPrincipal' });
    expect(result.revised!.method).toBe('equalPrincipal');
    expect(result.revised!.monthlyDecrementCents).toBeGreaterThan(0);
  });
});

describe('computePrepayment — 全部提前还清', () => {
  const result = computePrepayment({ ...PARTIAL, kind: 'full' });

  it('repays exactly the outstanding principal and saves all remaining interest', () => {
    expect(result.prepayAmountCents).toBe(result.remainingPrincipalCents);
    expect(result.interestSavedCents).toBe(result.remainingInterestCents);
  });

  it('leaves no revised contract behind', () => {
    expect(result.revised).toBeNull();
    expect(result.revisedSchedule).toEqual([]);
  });

  it('is what a partial prepayment of more than the balance degrades to', () => {
    const over = computePrepayment({ ...PARTIAL, amountCents: 99_999_999_999 });
    expect(over.prepayAmountCents).toBe(over.remainingPrincipalCents);
    expect(over.revised).toBeNull();
  });
});

describe('computePrepayment — 利率变动 (LPR repricing)', () => {
  it('separates what the rate cut saved from what the prepayment saved', () => {
    const result = computePrepayment({ ...PARTIAL, newAnnualRateBps: 300 });
    expect(result.interestSavedCents).toBeGreaterThan(result.interestSavedFromPrepaymentCents);
  });

  it('reports the two as equal when the rate is unchanged', () => {
    const result = computePrepayment(PARTIAL);
    expect(result.interestSavedCents).toBe(result.interestSavedFromPrepaymentCents);
  });
});

describe('computePrepayment — edges', () => {
  it('treats a prepayment before the first installment as nothing paid yet', () => {
    const result = computePrepayment({ ...PARTIAL, prepayDateIso: '2020-01-15' });
    expect(result.paidPeriods).toBe(0);
    expect(result.remainingPrincipalCents).toBe(CONTRACT.principalCents);
  });

  it('never reports a negative saving after the loan has already run its course', () => {
    const result = computePrepayment({ ...PARTIAL, prepayDateIso: '2060-01-01' });
    expect(result.paidPeriods).toBe(360);
    expect(result.remainingPrincipalCents).toBe(0);
    expect(result.interestSavedCents).toBeGreaterThanOrEqual(0);
  });

  it('reports an unpayable plan instead of an infinite term', () => {
    // A 1-month contract leaves a retained payment far too small to clear a
    // barely-reduced balance at 30% interest.
    const result = computePrepayment({
      contract: { principalCents: 100_000_000, annualRateBps: 3000, termMonths: 360, method: 'equalInstallment', startDateIso: '2020-01-01' },
      prepayDateIso: '2020-01-01',
      kind: 'partial',
      amountCents: 1,
      plan: 'shortenTerm',
      newAnnualRateBps: 9000,
    });
    expect(result.error).toBe('paymentBelowInterest');
    expect(result.revised).toBeNull();
  });

  it('handles a zero-interest loan', () => {
    const result = computePrepayment({
      ...PARTIAL,
      contract: { ...CONTRACT, annualRateBps: 0 },
    });
    expect(result.paidInterestCents).toBe(0);
    expect(result.remainingInterestCents).toBe(0);
    expect(result.interestSavedCents).toBe(0);
  });

  it('returns an empty result for a degenerate contract instead of NaN', () => {
    expect(computePrepayment({ ...PARTIAL, contract: { ...CONTRACT, principalCents: 0 } }).paidPeriods).toBe(0);
    expect(computePrepayment({ ...PARTIAL, contract: { ...CONTRACT, termMonths: 0 } }).revisedSchedule).toEqual([]);
  });
});
