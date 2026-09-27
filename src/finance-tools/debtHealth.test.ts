import { monthlyPaymentCents } from './amortization';
import {
  CAR_LOAN_RULE,
  MORTGAGE_RULE,
  healthLevel,
  interestSharePercent,
  loanToValuePercent,
  paymentSharePercent,
  rateShocks,
  stressTest,
} from './debtHealth';

const LOAN = { owedCents: 40_000_000, rateBps: 400, remainingMonths: 300, monthlyIncomeCents: 1_000_000 };

describe('paymentSharePercent', () => {
  it('is the payment over take-home', () => {
    expect(paymentSharePercent(250_000, 1_000_000)).toBe(25);
  });
  it('has no answer without income', () => {
    expect(paymentSharePercent(250_000, 0)).toBeNull();
  });
});

describe('healthLevel', () => {
  it('bands a mortgage at 25 / 35', () => {
    expect(healthLevel(25, MORTGAGE_RULE)).toBe('healthy');
    expect(healthLevel(30, MORTGAGE_RULE)).toBe('stretched');
    expect(healthLevel(36, MORTGAGE_RULE)).toBe('atRisk');
  });
  it('bands a car loan at 10 / 15', () => {
    expect(healthLevel(10, CAR_LOAN_RULE)).toBe('healthy');
    expect(healthLevel(12, CAR_LOAN_RULE)).toBe('stretched');
    expect(healthLevel(16, CAR_LOAN_RULE)).toBe('atRisk');
  });
});

describe('stressTest', () => {
  it('reprices the balance at rate + 2 over the months left', () => {
    const r = stressTest(LOAN, MORTGAGE_RULE)!;
    expect(r.rateBps).toBe(600);
    expect(r.paymentCents).toBe(monthlyPaymentCents(40_000_000, 600, 300));
    expect(r.percent).toBeCloseTo((r.paymentCents / 1_000_000) * 100, 6);
  });
  it('uses the 5.25% floor on a low rate', () => {
    expect(stressTest({ ...LOAN, rateBps: 200 }, MORTGAGE_RULE)!.rateBps).toBe(525);
  });
  it('has no answer for a loan that never pays off', () => {
    expect(stressTest({ ...LOAN, remainingMonths: Infinity }, MORTGAGE_RULE)).toBeNull();
  });
  it('still reprices without income, just with no share', () => {
    const r = stressTest({ ...LOAN, monthlyIncomeCents: 0 }, MORTGAGE_RULE)!;
    expect(r.percent).toBeNull();
    expect(r.level).toBeNull();
  });
});

describe('rateShocks', () => {
  it('gives +1/+2/+3 points, each payment higher', () => {
    const shocks = rateShocks(LOAN, MORTGAGE_RULE);
    expect(shocks.map((s) => s.rateBps)).toEqual([500, 600, 700]);
    expect(shocks[1].paymentCents).toBeGreaterThan(shocks[0].paymentCents);
    expect(shocks[2].paymentCents).toBeGreaterThan(shocks[1].paymentCents);
  });
});

describe('interestSharePercent', () => {
  it('is one month of interest over the payment', () => {
    expect(interestSharePercent(12_000_000, 500, 100_000)).toBeCloseTo(50, 6);
  });
  it('caps at 100', () => {
    expect(interestSharePercent(12_000_000, 500, 10_000)).toBe(100);
  });
});

describe('loanToValuePercent', () => {
  it('is owed over value', () => {
    expect(loanToValuePercent(40_000_000, 50_000_000)).toBe(80);
  });
  it('has no answer without a value', () => {
    expect(loanToValuePercent(40_000_000, null)).toBeNull();
  });
});
