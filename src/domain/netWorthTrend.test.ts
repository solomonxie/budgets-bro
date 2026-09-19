import { netWorthTrend } from './netWorthTrend';
import type { TrendAccount } from './netWorthTrend';

const cash: TrendAccount = {
  id: 1,
  type: 'cash',
  openingBalanceCents: 0,
  originalPrincipalCents: null,
  termMonths: null,
  originalHousePriceCents: null,
  originationDate: null,
  createdAt: '2026-01-01',
};
const empty = {
  activity: [],
  readings: [],
  payments: [],
  rateByAccountId: new Map<number, number>(),
  // Far enough ahead that these cases are about months, not about today.
  asOfDate: '2026-12-31',
};

describe('netWorthTrend', () => {
  it('carries a ledger balance forward through months with no activity', () => {
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02', '2026-03'],
      accounts: [cash],
      activity: [{ accountId: 1, month: '2026-01', totalCents: 100_000 }],
    });
    expect(points.map((p) => p.netWorthCents)).toEqual([
      100_000, 100_000, 100_000,
    ]);
  });

  it('counts each month only up to itself, not the whole ledger', () => {
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02'],
      accounts: [cash],
      activity: [
        { accountId: 1, month: '2026-01', totalCents: 100_000 },
        { accountId: 1, month: '2026-02', totalCents: 50_000 },
      ],
    });
    expect(points.map((p) => p.netWorthCents)).toEqual([100_000, 150_000]);
  });

  it('uses the value logged back then, not the newest one', () => {
    const rrsp: TrendAccount = { ...cash, id: 2, type: 'tracking' };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02', '2026-03'],
      accounts: [rrsp],
      readings: [
        {
          accountId: 2,
          kind: 'value',
          valueCents: 500_000,
          effectiveDate: '2026-01-15',
        },
        {
          accountId: 2,
          kind: 'value',
          valueCents: 900_000,
          effectiveDate: '2026-03-10',
        },
      ],
    });
    expect(points.map((p) => p.netWorthCents)).toEqual([
      500_000, 500_000, 900_000,
    ]);
  });

  it('is zero for a logged-value account before its first reading', () => {
    const rrsp: TrendAccount = { ...cash, id: 2, type: 'tracking' };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01'],
      accounts: [rrsp],
      readings: [
        {
          accountId: 2,
          kind: 'value',
          valueCents: 500_000,
          effectiveDate: '2026-02-01',
        },
      ],
    });
    expect(points[0].netWorthCents).toBe(0);
  });

  it('nets a mortgage to equity, month by month', () => {
    const mortgage: TrendAccount = {
      id: 3,
      type: 'mortgage',
      openingBalanceCents: -30_000_000,
      originalPrincipalCents: 30_000_000,
      termMonths: null,
      originalHousePriceCents: null,
      originationDate: '2026-01-01',
      createdAt: '2026-01-01',
    };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02'],
      accounts: [mortgage],
      readings: [
        {
          accountId: 3,
          kind: 'value',
          valueCents: 45_000_000,
          effectiveDate: '2026-01-01',
        },
        {
          accountId: 3,
          kind: 'principal',
          valueCents: 30_000_000,
          effectiveDate: '2026-01-01',
        },
        {
          accountId: 3,
          kind: 'principal',
          valueCents: 29_500_000,
          effectiveDate: '2026-02-20',
        },
      ],
      rateByAccountId: new Map([[3, 600]]),
    });
    expect(points[0]).toMatchObject({
      month: '2026-01',
      assetsCents: 45_000_000,
      debtsCents: 30_000_000,
      netWorthCents: 15_000_000,
    });
    // The home is the mortgage's own asset, and the breakdown says where the
    // figure came from.
    expect(points[0].contributions).toEqual([
      {
        accountId: 3,
        type: 'mortgage',
        balanceCents: -30_000_000,
        houseValueCents: 45_000_000,
        source: 'reading',
      },
    ]);
    // February's own statement re-anchors the debt, and the equity with it.
    expect(points[1].debtsCents).toBe(29_500_000);
    expect(points[1].netWorthCents).toBe(15_500_000);
  });

  it('does not sink the early months of a mortgage older than the ledger', () => {
    // Bought in 2006 with 20% down; the board's transactions only start in
    // 2024. None of those eighteen years of payments are on file, so the
    // derivation used to walk the whole principal through eighteen years of
    // interest and report two and a half times what was borrowed — a net
    // worth a quarter of a million under water in years that were never
    // anything but positive.
    const mortgage: TrendAccount = {
      id: 6,
      type: 'mortgage',
      openingBalanceCents: -17_040_000,
      originalPrincipalCents: 17_040_000,
      termMonths: 360,
      originalHousePriceCents: 21_300_000,
      originationDate: '2006-01-01',
      createdAt: '2024-01-01',
    };
    const points = netWorthTrend({
      ...empty,
      months: ['2024-01', '2024-02'],
      accounts: [mortgage],
      payments: [{ accountId: 6, date: '2024-02-01', amountCents: 91_474 }],
      rateByAccountId: new Map([[6, 500]]),
    });
    // Eighteen years into a thirty-year term, the schedule answers.
    expect(points[0].debtsCents).toBe(9_890_438);
    expect(points[1].debtsCents).toBe(9_840_174);
    expect(points.map((p) => p.netWorthCents)).toEqual([
      21_300_000 - 9_890_438,
      21_300_000 - 9_840_174,
    ]);
  });

  const loan: TrendAccount = {
    id: 4,
    type: 'loan',
    openingBalanceCents: -1_000_000,
    originalPrincipalCents: 1_000_000,
    termMonths: null,
    originalHousePriceCents: null,
    originationDate: '2026-01-01',
    createdAt: '2026-01-01',
  };

  it('walks the payments on from the last statement before the month', () => {
    // A statement re-anchors the debt and the payments after it bring it
    // down, interest first. What is never done is walking forward from the
    // origination across years the ledger knows nothing about — those
    // months follow the contract's schedule instead (see the test above).
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02', '2026-03'],
      accounts: [loan],
      readings: [
        {
          accountId: 4,
          kind: 'principal',
          valueCents: 1_000_000,
          effectiveDate: '2026-01-10',
        },
        {
          accountId: 4,
          kind: 'principal',
          valueCents: 900_000,
          effectiveDate: '2026-02-15',
        },
      ],
      payments: [{ accountId: 4, date: '2026-02-20', amountCents: 500_000 }],
      rateByAccountId: new Map([[4, 0]]),
    });
    // February's statement says 900,000; the payment five days later takes
    // it to 400,000 (no rate on file, so all of it is principal).
    expect(points.map((p) => p.debtsCents)).toEqual([
      1_000_000, 400_000, 400_000,
    ]);
  });

  it('carries the oldest statement back through the months before it', () => {
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02'],
      accounts: [loan],
      readings: [
        {
          accountId: 4,
          kind: 'principal',
          valueCents: 900_000,
          effectiveDate: '2026-02-15',
        },
      ],
      rateByAccountId: new Map([[4, 0]]),
    });
    expect(points.map((p) => p.debtsCents)).toEqual([900_000, 900_000]);
  });

  it('derives the month we are standing in, so the line ends where the card does', () => {
    const points = netWorthTrend({
      ...empty,
      months: ['2026-11', '2026-12'],
      accounts: [loan],
      readings: [
        {
          accountId: 4,
          kind: 'principal',
          valueCents: 1_000_000,
          effectiveDate: '2026-01-10',
        },
      ],
      payments: [{ accountId: 4, date: '2026-12-05', amountCents: 100_000 }],
      rateByAccountId: new Map([[4, 0]]),
      asOfDate: '2026-12-31',
    });
    expect(points.map((p) => p.debtsCents)).toEqual([1_000_000, 900_000]);
  });

  it('adds assets and debts across accounts in the same month', () => {
    const card: TrendAccount = { ...cash, id: 5, type: 'credit_card' };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01'],
      accounts: [cash, card],
      activity: [
        { accountId: 1, month: '2026-01', totalCents: 500_000 },
        { accountId: 5, month: '2026-01', totalCents: -120_000 },
      ],
    });
    expect(points[0]).toMatchObject({
      month: '2026-01',
      assetsCents: 500_000,
      debtsCents: 120_000,
      netWorthCents: 380_000,
    });
  });

  it('leaves an account out of the months before its own history began', () => {
    // The mortgage was taken out in March; the chart starts in January
    // because a cash account had transactions then. February must not show
    // the house debt, and January must not show the cash either.
    const mortgage: TrendAccount = {
      id: 2,
      type: 'mortgage',
      openingBalanceCents: -30_000_000,
      originalPrincipalCents: 30_000_000,
      termMonths: null,
      originalHousePriceCents: null,
      originationDate: '2026-03-15',
      createdAt: '2026-03-15',
    };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02', '2026-03'],
      accounts: [cash, mortgage],
      activity: [{ accountId: 1, month: '2026-02', totalCents: 100_000 }],
      readings: [
        {
          accountId: 2,
          kind: 'value',
          valueCents: 40_000_000,
          effectiveDate: '2026-03-15',
        },
      ],
    });
    expect(points.map((p) => p.debtsCents)).toEqual([0, 0, 30_000_000]);
    // January: neither account had started. February: cash only.
    expect(points.map((p) => p.netWorthCents)).toEqual([
      0, 100_000, 10_100_000,
    ]);
  });

  it('counts an account with no dated history at all from the first month', () => {
    const mystery: TrendAccount = {
      ...cash,
      id: 3,
      openingBalanceCents: 500_000,
    };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02'],
      accounts: [mystery],
    });
    expect(points.map((p) => p.netWorthCents)).toEqual([500_000, 500_000]);
  });

  it('starts an account at its first reading when that predates its transactions', () => {
    const rrsp: TrendAccount = { ...cash, id: 4, type: 'tracking' };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02', '2026-03'],
      accounts: [rrsp],
      readings: [
        {
          accountId: 4,
          kind: 'value',
          valueCents: 700_000,
          effectiveDate: '2026-02-01',
        },
      ],
    });
    expect(points.map((p) => p.netWorthCents)).toEqual([0, 700_000, 700_000]);
  });

  it('values a home at its purchase price until one is logged by hand', () => {
    // Bought in January for 400k against a 300k mortgage; the first manual
    // valuation only arrives in March. February must still show the house.
    const mortgage: TrendAccount = {
      id: 5,
      type: 'mortgage',
      openingBalanceCents: -30_000_000,
      originalPrincipalCents: 30_000_000,
      termMonths: null,
      originalHousePriceCents: 40_000_000,
      originationDate: '2026-01-10',
      createdAt: '2026-01-10',
    };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02', '2026-03'],
      accounts: [mortgage],
      readings: [
        {
          accountId: 5,
          kind: 'value',
          valueCents: 42_000_000,
          effectiveDate: '2026-03-01',
        },
      ],
    });
    expect(points.map((p) => p.assetsCents)).toEqual([
      40_000_000, 40_000_000, 42_000_000,
    ]);
    expect(points.map((p) => p.netWorthCents)).toEqual([
      10_000_000, 10_000_000, 12_000_000,
    ]);
  });

  it('carries the oldest valuation back when a home has no purchase price', () => {
    // Bought in January, but the only figure ever recorded is March's. The
    // early months must not show the mortgage standing alone.
    const mortgage: TrendAccount = {
      id: 6,
      type: 'mortgage',
      openingBalanceCents: -30_000_000,
      originalPrincipalCents: 30_000_000,
      termMonths: null,
      originalHousePriceCents: null,
      originationDate: '2026-01-10',
      createdAt: '2026-01-10',
    };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02', '2026-03'],
      accounts: [mortgage],
      readings: [
        {
          accountId: 6,
          kind: 'value',
          valueCents: 42_000_000,
          effectiveDate: '2026-03-01',
        },
      ],
    });
    expect(points.map((p) => p.assetsCents)).toEqual([
      42_000_000, 42_000_000, 42_000_000,
    ]);
    expect(points.every((p) => p.netWorthCents > 0)).toBe(true);
  });

  it('carries a valuation back over months nobody valued an asset in', () => {
    // A house: no transactions, and the only figure ever typed in arrives
    // in March. It did not come into existence that month.
    const house: TrendAccount = { ...cash, id: 7, type: 'asset' };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02', '2026-03'],
      accounts: [house],
      readings: [
        {
          accountId: 7,
          kind: 'value',
          valueCents: 22_800_000,
          effectiveDate: '2026-03-01',
        },
      ],
    });
    expect(points.map((p) => p.netWorthCents)).toEqual([
      22_800_000, 22_800_000, 22_800_000,
    ]);
  });

  it('adds what was paid into a tracking account after its last valuation', () => {
    // Before the first valuation it is the contributions alone; after one,
    // the valuation plus whatever went in since. Never zero for an account
    // that has been funded, and never a valuation that ignores a deposit
    // made the month after it.
    const rrsp: TrendAccount = { ...cash, id: 8, type: 'tracking' };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02', '2026-03'],
      accounts: [rrsp],
      activity: [
        { accountId: 8, month: '2026-01', totalCents: 100_000 },
        { accountId: 8, month: '2026-03', totalCents: 50_000 },
      ],
      readings: [
        {
          accountId: 8,
          kind: 'value',
          valueCents: 900_000,
          effectiveDate: '2026-02-01',
        },
      ],
    });
    expect(points.map((p) => p.netWorthCents)).toEqual([
      100_000, 900_000, 950_000,
    ]);
    expect(points[0].contributions[0].source).toBe('ledger');
  });
});
