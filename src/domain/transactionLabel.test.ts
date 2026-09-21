import { transactionSubLabel } from './transactionLabel';
import type { TransactionLabelRow } from './transactionLabel';

const row = (over: Partial<TransactionLabelRow>): TransactionLabelRow => ({
  categoryIcon: null,
  categoryName: null,
  amountCents: -1000,
  accountType: 'cash',
  transferAccountId: null,
  ...over,
});

describe('transactionSubLabel', () => {
  it('names the category when there is one', () => {
    expect(
      transactionSubLabel(row({ categoryName: 'Groceries', categoryIcon: '🛒' })),
    ).toEqual({ kind: 'category', icon: '🛒', name: 'Groceries' });
  });

  it('calls money in income', () => {
    expect(transactionSubLabel(row({ amountCents: 250000 }))).toEqual({
      kind: 'income',
    });
  });

  it('calls an uncategorized outflow uncategorized', () => {
    expect(transactionSubLabel(row({}))).toEqual({ kind: 'uncategorized' });
  });

  it('says nothing for a transfer leg — money moving is not arriving', () => {
    expect(transactionSubLabel(row({ transferAccountId: 7 }))).toBeNull();
    expect(
      transactionSubLabel(row({ amountCents: 5000, transferAccountId: 7 })),
    ).toBeNull();
  });

  it('counts a deposit from outside into savings as income', () => {
    expect(
      transactionSubLabel(row({ amountCents: 5000, accountType: 'savings' })),
    ).toEqual({ kind: 'income' });
  });

  it('a categorized inflow still reads as its category', () => {
    expect(
      transactionSubLabel(row({ amountCents: 4000, categoryName: 'Refunds' })),
    ).toEqual({ kind: 'category', icon: null, name: 'Refunds' });
  });
});
