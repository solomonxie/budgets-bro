import {
  NO_PREPAYMENTS,
  plannedExtraAt,
  extrasFromCalendar,
  extrasToCalendar,
  monthAt,
  breakPenaltyCents,
  usualPaymentCents,
  nextRenewalMonth,
  extraMonthlyToPayOffBy,
  downPaymentCents,
  maxQualifyingPriceCents,
  monthlySchedule,
  mortgagePlan,
  pastRowsFromPayments,
} from './mortgagePlan';
import type { PlanInput } from './mortgagePlan';
import { paymentPlan } from './canadianMortgage';

const base: PlanInput = {
  priceCents: 800_000_00,
  down: { unit: 'percent', percent: 20 },
  rateBps: 450,
  amortizationMonths: 300,
  termMonths: 60,
  frequency: 'monthly',
  compounding: 'semiAnnual',
  province: 'BC',
  firstTimeBuyer: false,
  toronto: false,
  propertyTaxBps: 70,
  condoFeesCents: 0,
  heatCents: 100_00,
  otherMonthlyCents: 0,
  rentalIncomeCents: 0,
  otherClosingCents: 2_500_00,
  annualIncomeCents: 0,
  otherDebtsMonthlyCents: 0,
  prepayments: NO_PREPAYMENTS,
};

describe('downPaymentCents', () => {
  it('caps a percentage at the whole price', () => {
    expect(
      downPaymentCents(800_000_00, { unit: 'percent', percent: 200000 }),
    ).toBe(800_000_00);
  });
  it('takes dollars as dollars', () => {
    expect(
      downPaymentCents(800_000_00, { unit: 'amount', cents: 200_000_00 }),
    ).toBe(200_000_00);
  });
});

describe('monthlySchedule', () => {
  it('pays the loan off on schedule with no extras', () => {
    const payment = paymentPlan(640_000_00, 450, 300).paymentCents;
    const rows = monthlySchedule(640_000_00, 450, 'semiAnnual', payment);
    expect(rows.length).toBeGreaterThanOrEqual(299);
    expect(rows.length).toBeLessThanOrEqual(301);
    expect(rows[rows.length - 1].balanceCents).toBe(0);
    expect(rows[0].principalCents + rows[0].interestCents).toBe(payment);
  });

  it('a lump sum shortens the loan and cuts interest', () => {
    const payment = paymentPlan(640_000_00, 450, 300).paymentCents;
    const plain = monthlySchedule(640_000_00, 450, 'semiAnnual', payment);
    const lump = monthlySchedule(640_000_00, 450, 'semiAnnual', payment, {
      monthlyCents: 0,
      yearlyCents: 0,
      lumps: { 12: 50_000_00 },
    });
    expect(lump[11].extraCents).toBe(50_000_00);
    expect(lump.length).toBeLessThan(plain.length);
    const interest = (rows: typeof plain) =>
      rows.reduce((s, r) => s + r.interestCents, 0);
    expect(interest(lump)).toBeLessThan(interest(plain));
  });
});

describe('mortgagePlan', () => {
  it('gives sane figures for a typical purchase', () => {
    const r = mortgagePlan(base);
    expect(r.downCents).toBe(160_000_00);
    expect(r.insurance.totalMortgageCents).toBe(640_000_00);
    // 640k at 4.5% semi-annual over 25 years is about $3,545/month.
    expect(r.monthlyPaymentCents).toBeGreaterThan(3_500_00);
    expect(r.monthlyPaymentCents).toBeLessThan(3_600_00);
    // BC transfer tax on $800k: 1% of 200k + 2% of 600k = $14,000.
    expect(r.closing.provincialTax.netCents).toBe(14_000_00);
    expect(r.closing.totalCents).toBe(160_000_00 + 14_000_00 + 2_500_00);
    expect(r.term.balanceCents).toBeLessThan(640_000_00);
    expect(r.term.balanceCents).toBeGreaterThan(500_000_00);
    expect(r.qualifying.required.requiredAnnualCents).toBeGreaterThan(
      140_000_00,
    );
  });

  it('finds the highest price an income qualifies for', () => {
    const income = mortgagePlan(base).qualifying.required.requiredAnnualCents;
    const max = maxQualifyingPriceCents(
      {
        priceCents: base.priceCents,
        down: base.down,
        amortizationMonths: base.amortizationMonths,
        rateBps: base.rateBps,
        propertyTaxBps: base.propertyTaxBps,
        heatCents: base.heatCents,
        condoFeesCents: base.condoFeesCents,
        otherDebtsMonthlyCents: 0,
      },
      income,
    )!;
    expect(Math.abs(max - base.priceCents)).toBeLessThanOrEqual(2_000_00);
  });

  it('renewal at a higher rate raises the payment', () => {
    const r = mortgagePlan(base);
    expect(r.renewal[0].shockBps).toBe(0);
    expect(r.renewal[2].monthlyPaymentCents).toBeGreaterThan(
      r.renewal[0].monthlyPaymentCents,
    );
  });
});

describe('mortgagePlan for a mortgage already held', () => {
  it('runs from the balance and payment, with nothing to close', () => {
    const r = mortgagePlan({
      ...base,
      priceCents: 900_000_00,
      existing: { balanceCents: 400_000_00, monthlyPaymentCents: 3_000_00 },
    });
    expect(r.monthlyPaymentCents).toBe(3_000_00);
    expect(r.closing.totalCents).toBe(0);
    expect(r.schedule[0].balanceCents).toBeLessThan(400_000_00);
    expect(r.insurance.ltvBps).toBe(4444);
  });
});

describe('recurring extras', () => {
  it('pays from a month until the next change, and a one-off replaces one month', () => {
    const p = {
      monthlyCents: 0,
      yearlyCents: 0,
      lumps: { 5: 0, 7: 900_00 },
      recurring: { 3: 100_00, 6: 200_00, 9: 0 },
    };
    expect(
      [1, 3, 4, 5, 6, 7, 8, 9, 10].map((m) => plannedExtraAt(p, m)),
    ).toEqual([0, 100_00, 100_00, 0, 200_00, 900_00, 200_00, 0, 0]);
  });
});

describe('calendar extras', () => {
  it('round-trips, drops past lumps and carries a running amount', () => {
    const cal = {
      lumps: { '2026-01': 500_00, '2027-03': 1000_00 },
      recurring: { '2025-06': 100_00, '2027-01': 200_00 },
    };
    const s = extrasFromCalendar(cal, '2026-11');
    expect(s.lumps).toEqual({ 5: 1000_00 });
    expect(s.recurring).toEqual({ 1: 100_00, 3: 200_00 });
    const back = extrasToCalendar(s, '2026-11', cal);
    expect(back.lumps).toEqual(cal.lumps);
    expect(back.recurring['2027-01']).toBe(200_00);
    expect(monthAt('2026-11', 3)).toBe('2027-01');
  });
});

describe('break penalty', () => {
  it('is the larger of three months and the IRD on a fixed rate', () => {
    const base = {
      balanceCents: 400_000_00,
      rateBps: 500,
      comparisonRateBps: 400,
      monthsLeftInTerm: 36,
    };
    expect(breakPenaltyCents({ ...base, fixed: true }).penaltyCents).toBe(
      12_000_00,
    );
    expect(breakPenaltyCents({ ...base, fixed: false }).penaltyCents).toBe(
      5_000_00,
    );
  });
});

describe('held history helpers', () => {
  it('usual payment is the median', () => {
    expect(usualPaymentCents([2000_00, 2100_00, 9000_00])).toBe(2100_00);
    expect(usualPaymentCents([])).toBeNull();
  });

  it('renewal rolls forward past today', () => {
    expect(nextRenewalMonth('2020-03', 60, '2026-10')).toBe('2030-03');
    expect(nextRenewalMonth('2024-03', 60, '2026-10')).toBe('2029-03');
  });

  it('finds the extra that meets a payoff target', () => {
    const payment = paymentPlan(400_000_00, 500, 300).paymentCents;
    const extra = extraMonthlyToPayOffBy(
      400_000_00,
      500,
      'semiAnnual',
      payment,
      180,
    )!;
    const months = (x: number) =>
      monthlySchedule(400_000_00, 500, 'semiAnnual', payment, {
        ...NO_PREPAYMENTS,
        monthlyCents: x,
      }).length;
    expect(months(extra)).toBeLessThanOrEqual(180);
    expect(months(extra - 200)).toBeGreaterThan(180);
    expect(
      extraMonthlyToPayOffBy(400_000_00, 500, 'semiAnnual', payment, 400),
    ).toBeNull();
  });
});

describe('pastRowsFromPayments', () => {
  const rows = pastRowsFromPayments({
    owedCents: 16_800_000,
    paidByMonth: { '2026-01': 80_000, '2026-03': 180_000 },
    fromMonth: '2026-01',
    toMonth: '2026-04',
    rateBpsAt: () => 320,
    compounding: 'semiAnnual',
  });

  it('ends on what is owed now, a row per month', () => {
    expect(rows.map((r) => r.month)).toEqual([1, 2, 3, 4]);
    expect(rows[3].balanceCents).toBe(16_800_000);
  });

  it('shows what was paid, interest first, and each row follows the last', () => {
    expect(rows.map((r) => r.paymentCents)).toEqual([80_000, 0, 180_000, 0]);
    for (const r of rows)
      expect(r.principalCents + r.interestCents).toBe(r.paymentCents);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i].balanceCents).toBe(
        rows[i - 1].balanceCents - rows[i].principalCents,
      );
    expect(rows[1].principalCents).toBeLessThan(0);
  });
});
