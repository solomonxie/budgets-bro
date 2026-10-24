import { matchesSearch } from './transactionSearch';

const txn = {
  payeeName: 'Costco',
  memo: 'Birthday cake',
  categoryName: 'Groceries',
  purchaseItems: 'milk=4.99',
  date: '2026-10-12',
  amountCents: -123450,
};

test.each([
  ['', true],
  ['costco', true],
  ['CAKE', true],
  ['grocer', true],
  ['milk', true],
  ['2026-10', true],
  ['1234.5', true],
  ['$1,234.50', true],
  ['-1234', true],
  ['cstco', true],
  ['costco cake', true],
  ['grcrs', true],
  ['costco rent', false],
  ['ostco', true],
  ['stco', true],
  ['cz', false],
  ['rent', false],
  ['999', false],
])('%s → %s', (query, expected) => {
  expect(matchesSearch(txn, query)).toBe(expected);
});
