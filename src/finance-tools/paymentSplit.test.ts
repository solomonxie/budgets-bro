import { splitActualPayments, wholeMonthsBetween } from './paymentSplit';

describe('wholeMonthsBetween', () => {
  it('counts a full month only once the day of month is reached', () => {
    expect(wholeMonthsBetween('2026-01-15', '2026-02-14')).toBe(0);
    expect(wholeMonthsBetween('2026-01-15', '2026-02-15')).toBe(1);
    expect(wholeMonthsBetween('2026-01-15', '2026-04-15')).toBe(3);
  });

  it('never goes negative', () => {
    expect(wholeMonthsBetween('2026-05-01', '2026-01-01')).toBe(0);
  });
});

describe('splitActualPayments', () => {
  const base = { openingOwedCents: 30_000_000, annualRateBps: 600, startDate: '2026-01-01' };

  it('takes interest first, the rest off the principal', () => {
    const { rows } = splitActualPayments({ ...base, payments: [{ date: '2026-02-01', amountCents: 200_000 }] });
    // 1 month at 6%/yr on $300,000 = $1,500
    expect(rows[0].interestCents).toBe(150_000);
    expect(rows[0].principalCents).toBe(50_000);
    expect(rows[0].owedCents).toBe(29_950_000);
  });

  it('a second payment in the same month is all principal', () => {
    const { rows } = splitActualPayments({
      ...base,
      payments: [
        { date: '2026-02-01', amountCents: 200_000 },
        { date: '2026-02-20', amountCents: 100_000 },
      ],
    });
    expect(rows[1].interestCents).toBe(0);
    expect(rows[1].principalCents).toBe(100_000);
    expect(rows[1].owedCents).toBe(29_850_000);
  });

  it('a skipped month accrues interest the next payment has to cover first', () => {
    const oneMonth = splitActualPayments({ ...base, payments: [{ date: '2026-02-01', amountCents: 1_000_000 }] });
    const threeMonths = splitActualPayments({ ...base, payments: [{ date: '2026-04-01', amountCents: 1_000_000 }] });
    expect(oneMonth.rows[0].interestCents).toBe(150_000);
    // Three months compounding, so more than 3x one month's interest.
    expect(threeMonths.rows[0].interestCents).toBeGreaterThan(450_000);
    expect(threeMonths.rows[0].principalCents).toBeLessThan(oneMonth.rows[0].principalCents);
  });

  it('two missed months can leave a normal payment unable to touch the principal', () => {
    const { rows } = splitActualPayments({ ...base, payments: [{ date: '2026-04-01', amountCents: 200_000 }] });
    expect(rows[0].interestCents).toBe(200_000);
    expect(rows[0].principalCents).toBe(0);
    // Interest accrued beyond the payment, so the debt grew.
    expect(rows[0].owedCents).toBeGreaterThan(base.openingOwedCents);
  });

  it('a payment smaller than the interest owed pays no principal', () => {
    const { rows } = splitActualPayments({ ...base, payments: [{ date: '2026-02-01', amountCents: 100_000 }] });
    expect(rows[0].interestCents).toBe(100_000);
    expect(rows[0].principalCents).toBe(0);
    // The unpaid $500 of that month's interest is still owed.
    expect(rows[0].owedCents).toBe(30_050_000);
  });

  it('a payoff overpayment settles the balance without going negative', () => {
    const { rows, owedCents } = splitActualPayments({
      openingOwedCents: 100_000,
      annualRateBps: 0,
      startDate: '2026-01-01',
      payments: [{ date: '2026-02-01', amountCents: 500_000 }],
    });
    expect(rows[0].principalCents).toBe(100_000);
    expect(owedCents).toBe(0);
  });

  it('interest-free loans put every cent on the principal', () => {
    const { owedCents, interestPaidCents, principalPaidCents } = splitActualPayments({
      openingOwedCents: 1_200_000,
      annualRateBps: 0,
      startDate: '2026-01-01',
      payments: [
        { date: '2026-02-01', amountCents: 100_000 },
        { date: '2026-03-01', amountCents: 100_000 },
      ],
    });
    expect(interestPaidCents).toBe(0);
    expect(principalPaidCents).toBe(200_000);
    expect(owedCents).toBe(1_000_000);
  });

  it('a negative amount moves the balance with no interest split', () => {
    const { rows } = splitActualPayments({
      ...base,
      payments: [{ date: '2026-01-01', amountCents: -500_000 }],
    });
    expect(rows[0].interestCents).toBe(0);
    expect(rows[0].owedCents).toBe(30_500_000);
  });

  it('totals add up to what was actually paid', () => {
    const { interestPaidCents, principalPaidCents } = splitActualPayments({
      ...base,
      payments: [
        { date: '2026-02-01', amountCents: 200_000 },
        { date: '2026-03-01', amountCents: 200_000 },
        { date: '2026-04-01', amountCents: 200_000 },
      ],
    });
    expect(interestPaidCents + principalPaidCents).toBe(600_000);
  });

  it('sorts payments entered out of order', () => {
    const { rows } = splitActualPayments({
      ...base,
      payments: [
        { date: '2026-03-01', amountCents: 200_000 },
        { date: '2026-02-01', amountCents: 200_000 },
      ],
    });
    expect(rows.map((r) => r.date)).toEqual(['2026-02-01', '2026-03-01']);
  });
});
