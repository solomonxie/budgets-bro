import { netWorthTrend } from './netWorthTrend';
import type { TrendAccount } from './netWorthTrend';

const cash: TrendAccount = {
  id: 1,
  type: 'cash',
  openingBalanceCents: 0,
  originalPrincipalCents: null,
  originationDate: null,
  createdAt: '2026-01-01',
};
const empty = { activity: [], readings: [], payments: [], rateByAccountId: new Map<number, number>() };

describe('netWorthTrend', () => {
  it('carries a ledger balance forward through months with no activity', () => {
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02', '2026-03'],
      accounts: [cash],
      activity: [{ accountId: 1, month: '2026-01', totalCents: 100_000 }],
    });
    expect(points.map((p) => p.netWorthCents)).toEqual([100_000, 100_000, 100_000]);
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
        { accountId: 2, kind: 'value', valueCents: 500_000, effectiveDate: '2026-01-15' },
        { accountId: 2, kind: 'value', valueCents: 900_000, effectiveDate: '2026-03-10' },
      ],
    });
    expect(points.map((p) => p.netWorthCents)).toEqual([500_000, 500_000, 900_000]);
  });

  it('is zero for a logged-value account before its first reading', () => {
    const rrsp: TrendAccount = { ...cash, id: 2, type: 'tracking' };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01'],
      accounts: [rrsp],
      readings: [{ accountId: 2, kind: 'value', valueCents: 500_000, effectiveDate: '2026-02-01' }],
    });
    expect(points[0].netWorthCents).toBe(0);
  });

  it('nets a mortgage to equity, month by month', () => {
    const mortgage: TrendAccount = {
      id: 3,
      type: 'mortgage',
      openingBalanceCents: -30_000_000,
      originalPrincipalCents: 30_000_000,
      originationDate: '2026-01-01',
      createdAt: '2026-01-01',
    };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02'],
      accounts: [mortgage],
      readings: [{ accountId: 3, kind: 'value', valueCents: 45_000_000, effectiveDate: '2026-01-01' }],
      payments: [{ accountId: 3, date: '2026-02-01', amountCents: 200_000 }],
      rateByAccountId: new Map([[3, 600]]),
    });
    expect(points[0]).toEqual({ month: '2026-01', assetsCents: 45_000_000, debtsCents: 30_000_000, netWorthCents: 15_000_000 });
    // One payment: $1,500 of the $2,000 was interest, so the debt falls $500.
    expect(points[1].debtsCents).toBe(29_950_000);
  });

  it('ignores payments that had not happened yet', () => {
    const loan: TrendAccount = {
      id: 4,
      type: 'loan',
      openingBalanceCents: -1_000_000,
      originalPrincipalCents: 1_000_000,
      originationDate: '2026-01-01',
      createdAt: '2026-01-01',
    };
    const points = netWorthTrend({
      ...empty,
      months: ['2026-01', '2026-02'],
      accounts: [loan],
      payments: [{ accountId: 4, date: '2026-02-15', amountCents: 100_000 }],
      rateByAccountId: new Map([[4, 0]]),
    });
    expect(points[0].debtsCents).toBe(1_000_000);
    expect(points[1].debtsCents).toBe(900_000);
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
    expect(points[0]).toEqual({ month: '2026-01', assetsCents: 500_000, debtsCents: 120_000, netWorthCents: 380_000 });
  });
});
