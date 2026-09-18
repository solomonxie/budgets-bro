import { ACCOUNT_KIND_ORDER, isSpendingAccountType, netWorth, transactionTakesCategory } from './accountKind';

describe('netWorth', () => {
  it('nets a mortgage to home equity: value minus what is still owed', () => {
    const result = netWorth([{ type: 'mortgage', balanceCents: -30_000_000, houseValueCents: 45_000_000 }]);
    expect(result.assetsCents).toBe(45_000_000);
    expect(result.debtsCents).toBe(30_000_000);
    expect(result.netWorthCents).toBe(15_000_000);
  });

  it('counts a mortgage with no logged home value as debt only', () => {
    expect(netWorth([{ type: 'mortgage', balanceCents: -30_000_000 }]).netWorthCents).toBe(-30_000_000);
  });

  it('adds a credit card balance to debts', () => {
    const result = netWorth([
      { type: 'cash', balanceCents: 500_000 },
      { type: 'credit_card', balanceCents: -120_000 },
    ]);
    expect(result).toEqual({ assetsCents: 500_000, debtsCents: 120_000, netWorthCents: 380_000 });
  });
});

describe('ACCOUNT_KIND_ORDER', () => {
  it('puts Loan ahead of Asset', () => {
    expect(ACCOUNT_KIND_ORDER.indexOf('Loan')).toBeLessThan(ACCOUNT_KIND_ORDER.indexOf('Asset'));
  });

  it('covers every account kind exactly once', () => {
    expect([...ACCOUNT_KIND_ORDER].sort()).toEqual(['Asset', 'Cash', 'Credit', 'Loan', 'Savings', 'Tracking']);
  });
});

describe('isSpendingAccountType', () => {
  it('covers the accounts that spend assigned money', () => {
    expect(isSpendingAccountType('cash')).toBe(true);
    // A card purchase still spends out of a category — that is the envelope
    // system's whole point.
    expect(isSpendingAccountType('credit_card')).toBe(true);
  });

  it('excludes savings, which money sits in rather than leaves', () => {
    // What leaves savings goes to another account of yours and is
    // categorised when spent from there.
    expect(isSpendingAccountType('savings')).toBe(false);
  });

  it('excludes accounts where a category would mean nothing', () => {
    // No assigned cash behind them at all.
    expect(isSpendingAccountType('tracking')).toBe(false);
    expect(isSpendingAccountType('asset')).toBe(false);
    // Rows here are mirrored payment legs; the category is on the paying side.
    expect(isSpendingAccountType('loan')).toBe(false);
    expect(isSpendingAccountType('mortgage')).toBe(false);
  });
});

describe('transactionTakesCategory', () => {
  it('categorises ordinary spending', () => {
    expect(transactionTakesCategory('cash', false)).toBe(true);
    expect(transactionTakesCategory('credit_card', false)).toBe(true);
  });

  it('never categorises a transfer, whatever the account', () => {
    // Money moving between your own accounts is spent when it leaves the
    // other side, not here.
    expect(transactionTakesCategory('cash', true)).toBe(false);
    expect(transactionTakesCategory('credit_card', true)).toBe(false);
  });

  it('never categorises an account that does not spend', () => {
    expect(transactionTakesCategory('savings', false)).toBe(false);
    expect(transactionTakesCategory('mortgage', false)).toBe(false);
    expect(transactionTakesCategory('tracking', false)).toBe(false);
  });
});
