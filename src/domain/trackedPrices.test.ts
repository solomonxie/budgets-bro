import {
  purchaseItemHistory,
  purchaseItemNames,
  purchaseItemTrend,
  summarizePurchaseItems,
} from './purchaseInsights';
import type { TransactionWithLabels } from './types';

const txn = (
  id: number,
  date: string,
  purchaseItems: string | null,
): TransactionWithLabels => ({
  id,
  accountId: 1,
  categoryId: null,
  payeeId: null,
  memo: null,
  amountCents: -1000,
  date,
  transferAccountId: null,
  importId: null,
  purchaseItems,
  createdAt: '',
  updatedAt: '',
  payeeName: 'Shop',
  categoryName: null,
  categoryIcon: null,
  accountName: 'Cash',
  accountType: 'cash',
});

describe('summarizePurchaseItems', () => {
  it('ranks by how often a thing was bought, not by spend', () => {
    const rows = [
      txn(1, '2026-09-01', 'Oil=8.40, Fridge=900'),
      txn(2, '2026-09-08', 'Oil=8.90'),
      txn(3, '2026-09-15', 'Oil=9.20'),
    ];
    const summary = summarizePurchaseItems(rows);
    expect(summary.map((s) => s.displayName)).toEqual(['Oil', 'Fridge']);
    expect(summary[0]).toMatchObject({
      count: 3,
      totalCents: 2650,
      avgCents: 883,
      minCents: 840,
      maxCents: 920,
      lastDate: '2026-09-15',
    });
  });

  it('groups on case and whitespace, and shows the commonest spelling', () => {
    const summary = summarizePurchaseItems([
      txn(1, '2026-09-01', 'Beef=12.99'),
      txn(2, '2026-09-02', ' beef =13.50'),
      txn(3, '2026-09-03', 'Beef=14.00'),
    ]);
    expect(summary).toHaveLength(1);
    expect(summary[0].name).toBe('beef');
    expect(summary[0].displayName).toBe('Beef');
    expect(summary[0].count).toBe(3);
  });

  it('skips pairs that are not prices, and rows with no items', () => {
    const summary = summarizePurchaseItems([
      txn(1, '2026-09-01', 'Warranty=2 years, Oil=8.40'),
      txn(2, '2026-09-02', null),
      txn(3, '2026-09-03', ''),
    ]);
    expect(summary.map((s) => s.displayName)).toEqual(['Oil']);
  });

  it('is empty for a ledger that never named an item', () => {
    expect(summarizePurchaseItems([txn(1, '2026-09-01', null)])).toEqual([]);
  });
});

describe('purchaseItemHistory', () => {
  it('is one row per day, newest first, averaging a repeated item', () => {
    const history = purchaseItemHistory(
      [
        txn(1, '2026-09-01', 'Oil=8.00'),
        txn(2, '2026-09-10', 'Oil=9.00'),
        txn(3, '2026-09-10', 'Oil=11.00'),
      ],
      'oil',
    );
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      date: '2026-09-10',
      count: 2,
      totalCents: 2000,
      priceCents: 1000,
    });
    expect(history[0].transactionIds).toEqual([2, 3]);
    expect(history[1].date).toBe('2026-09-01');
  });

  it('matches the name the same way the summary groups it', () => {
    const history = purchaseItemHistory([txn(1, '2026-09-01', 'Beef=12.99')], ' BEEF ');
    expect(history).toHaveLength(1);
  });
});

describe('purchaseItemTrend', () => {
  it('plots oldest to newest and benchmarks against everything before the last', () => {
    const history = purchaseItemHistory(
      [
        txn(1, '2026-09-01', 'Oil=8.00'),
        txn(2, '2026-09-08', 'Oil=10.00'),
        txn(3, '2026-09-15', 'Oil=15.00'),
      ],
      'oil',
    );
    const trend = purchaseItemTrend(history);
    expect(trend.points.map((p) => p.priceCents)).toEqual([800, 1000, 1500]);
    expect(trend.benchmarkCents).toBe(900);
  });

  it('has no benchmark from a single purchase', () => {
    const trend = purchaseItemTrend(
      purchaseItemHistory([txn(1, '2026-09-01', 'Oil=8.00')], 'oil'),
    );
    expect(trend.points).toHaveLength(1);
    expect(trend.benchmarkCents).toBeNull();
  });
});

describe('purchaseItemNames', () => {
  it('offers commonest first, and counts unpriced pairs too', () => {
    expect(
      purchaseItemNames([
        txn(1, '2026-09-01', 'Oil=8.40, Warranty=2 years'),
        txn(2, '2026-09-02', 'Oil=8.90'),
        txn(3, '2026-09-03', 'Beef=12.99'),
      ]),
    ).toEqual(['Oil', 'Beef', 'Warranty']);
  });

  it('is one name per spelling-insensitive thing', () => {
    expect(
      purchaseItemNames([
        txn(1, '2026-09-01', 'Beef=1'),
        txn(2, '2026-09-02', ' beef =2'),
      ]),
    ).toEqual(['Beef']);
  });
});
