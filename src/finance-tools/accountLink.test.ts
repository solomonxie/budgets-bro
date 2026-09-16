import { accountValueFor, linkedValueToFieldText } from './accountLink';
import type { AccountWithBalance } from '../db/repositories/accountsRepo';

function mortgage(overrides: Partial<AccountWithBalance['account']> = {}, balanceCents = -30_000_000): AccountWithBalance {
  return {
    balanceCents,
    account: {
      id: 1,
      name: 'Mortgage',
      type: 'mortgage',
      onBudget: false,
      currency: 'USD',
      openingBalanceCents: -30_000_000,
      archivedAt: null,
      createdAt: '2020-01-01',
      interestRateBps: null,
      termMonths: 360,
      originalPrincipalCents: 30_000_000,
      originationDate: '2020-03-15',
      originalHousePriceCents: 37_500_000,
      ...overrides,
    },
  };
}

describe('accountValueFor', () => {
  it('reports a debt balance as the amount owed, not the negative stored value', () => {
    expect(accountValueFor('balance', mortgage(), 650, '2026-09-15')).toBe(30_000_000);
  });

  it('passes through the current rate and the original term', () => {
    expect(accountValueFor('rateBps', mortgage(), 650, '2026-09-15')).toBe(650);
    expect(accountValueFor('termMonths', mortgage(), 650, '2026-09-15')).toBe(360);
  });

  it('derives the remaining term from the origination date', () => {
    // 2020-03-15 to 2026-09-15 is exactly 78 whole months.
    expect(accountValueFor('remainingTermMonths', mortgage(), 650, '2026-09-15')).toBe(360 - 78);
  });

  it('does not count a month that has not completed', () => {
    expect(accountValueFor('remainingTermMonths', mortgage(), 650, '2026-09-14')).toBe(360 - 77);
  });

  it('never returns a negative remaining term past the end of the contract', () => {
    expect(accountValueFor('remainingTermMonths', mortgage({ termMonths: 12 }), 650, '2026-09-15')).toBe(0);
  });

  it('derives the contractual monthly payment', () => {
    expect(accountValueFor('monthlyPayment', mortgage(), 600, '2026-09-15')).toBe(179865);
  });

  it('returns null when a column the quantity depends on is unset', () => {
    expect(accountValueFor('termMonths', mortgage({ termMonths: null }), 650, '2026-09-15')).toBeNull();
    expect(accountValueFor('remainingTermMonths', mortgage({ originationDate: null }), 650, '2026-09-15')).toBeNull();
    expect(accountValueFor('housePrice', mortgage({ originalHousePriceCents: null }), 650, '2026-09-15')).toBeNull();
    expect(accountValueFor('rateBps', mortgage(), null, '2026-09-15')).toBeNull();
    expect(accountValueFor('monthlyPayment', mortgage(), null, '2026-09-15')).toBeNull();
  });
});

describe('linkedValueToFieldText', () => {
  it('renders cents as dollars', () => {
    expect(linkedValueToFieldText('balance', 41_230_000)).toBe('412300');
    expect(linkedValueToFieldText('monthlyPayment', 179865)).toBe('1798.65');
  });

  it('renders basis points as a percentage figure', () => {
    expect(linkedValueToFieldText('rateBps', 450)).toBe('4.5');
  });

  it('leaves a month count alone', () => {
    expect(linkedValueToFieldText('remainingTermMonths', 282)).toBe('282');
  });
});
