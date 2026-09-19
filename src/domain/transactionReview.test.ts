import {
  duplicateGroups,
  duplicateTransactionIds,
  transactionsNeedingReview,
  matchesReviewFilter,
} from './transactionReview';
import type { TransactionWithLabels } from './types';

const txn = (over: Partial<TransactionWithLabels>): TransactionWithLabels => ({
  id: 1,
  accountId: 1,
  categoryId: 5,
  payeeId: 9,
  memo: null,
  amountCents: -1000,
  date: '2026-09-01',
  transferAccountId: null,
  importId: null,
  createdAt: '',
  updatedAt: '',
  payeeName: 'Cafe',
  categoryName: 'Dining',
  categoryIcon: null,
  accountName: 'Chequing',
  accountType: 'cash',
  ...over,
});

describe('transactionsNeedingReview', () => {
  it('leaves a complete row alone', () => {
    expect(transactionsNeedingReview([txn({})])).toEqual([]);
  });

  it('flags a missing payee and a missing category', () => {
    const [item] = transactionsNeedingReview([
      txn({ payeeId: null, payeeName: null, categoryId: null, categoryName: null }),
    ]);
    expect(item.reasons).toEqual(['missingPayee', 'missingCategory']);
  });

  it('does not call an inflow or a transfer uncategorized', () => {
    const inflow = txn({ id: 1, amountCents: 5000, categoryId: null, categoryName: null });
    const transfer = txn({ id: 2, amountCents: -2000, transferAccountId: 7, categoryId: null, categoryName: null });
    // A tracking account takes no category at all.
    const tracked = txn({ id: 3, amountCents: -3000, accountType: 'tracking', categoryId: null, categoryName: null });
    expect(transactionsNeedingReview([inflow, transfer, tracked])).toEqual([]);
  });

  it('flags a zero amount', () => {
    const [item] = transactionsNeedingReview([txn({ amountCents: 0 })]);
    expect(item.reasons).toEqual(['zeroAmount']);
  });
});

describe('duplicateTransactionIds', () => {
  it('keeps rows apart when their notes differ', () => {
    const ids = duplicateTransactionIds([
      txn({ id: 1, memo: 'split with Sam' }),
      txn({ id: 2, memo: null }),
    ]);
    expect(ids.size).toBe(0);
  });

  it('pairs rows carrying the same note', () => {
    const ids = duplicateTransactionIds([
      txn({ id: 1, memo: 'split with Sam' }),
      txn({ id: 2, memo: 'split with Sam' }),
    ]);
    expect([...ids].sort()).toEqual([1, 2]);
  });

  it('groups them for a merge', () => {
    const groups = duplicateGroups([
      txn({ id: 1 }),
      txn({ id: 2 }),
      txn({ id: 3, amountCents: -2000 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((t) => t.id)).toEqual([1, 2]);
  });

  it('pairs rows matching on account, date, amount and payee', () => {
    const ids = duplicateTransactionIds([
      txn({ id: 1 }),
      txn({ id: 2 }),
      txn({ id: 3, amountCents: -2000 }),
    ]);
    expect([...ids].sort()).toEqual([1, 2]);
  });

  it('keeps the two legs of a transfer apart', () => {
    const ids = duplicateTransactionIds([
      txn({ id: 1, accountId: 1, transferAccountId: 2, amountCents: -1000, payeeId: 20 }),
      txn({ id: 2, accountId: 2, transferAccountId: 1, amountCents: 1000, payeeId: 21 }),
    ]);
    expect(ids.size).toBe(0);
  });
});

describe('matchesReviewFilter', () => {
  const none = new Set<number>();

  it('matches only what its reason names', () => {
    const noPayee = txn({ payeeId: null, payeeName: null });
    expect(matchesReviewFilter(noPayee, 'missingPayee', none)).toBe(true);
    expect(matchesReviewFilter(noPayee, 'missingCategory', none)).toBe(false);
    expect(matchesReviewFilter(noPayee, 'any', none)).toBe(true);
  });

  it('counts a duplicate only under "any"', () => {
    const complete = txn({ id: 4 });
    expect(matchesReviewFilter(complete, 'any', new Set([4]))).toBe(true);
    expect(matchesReviewFilter(complete, 'missingPayee', new Set([4]))).toBe(false);
  });
});
