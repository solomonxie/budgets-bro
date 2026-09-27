import {
  ACCOUNT_KIND_ORDER,
  countsTowardNetWorth,
  isSpendingAccountType,
  netWorth,
  toppedUpByContributions,
  transactionTakesCategory,
  usesLoggedValue,
} from './accountKind';

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
    expect([...ACCOUNT_KIND_ORDER].sort()).toEqual(['Asset', 'Cash', 'Credit', 'Giving', 'Loan', 'Savings', 'Tracking']);
  });
});

describe('a giving account', () => {
  it('is left out of net worth on both sides', () => {
    expect(
      netWorth([
        { type: 'cash', balanceCents: 100_000 },
        { type: 'giving', balanceCents: 50_000 },
      ]),
    ).toEqual({
      assetsCents: 100_000,
      debtsCents: 0,
      netWorthCents: 100_000,
    });
  });

  it('is valued like a tracking account, not like an asset', () => {
    expect(usesLoggedValue('giving')).toBe(true);
    expect(toppedUpByContributions('giving')).toBe(true);
    expect(toppedUpByContributions('asset')).toBe(false);
    expect(countsTowardNetWorth('giving')).toBe(false);
    expect(countsTowardNetWorth('tracking')).toBe(true);
  });
});

describe('isSpendingAccountType', () => {
  it('covers the accounts that spend assigned money', () => {
    expect(isSpendingAccountType('cash')).toBe(true);
    // A card purchase still spends out of a category — that is the envelope
    // system's whole point.
    expect(isSpendingAccountType('credit_card')).toBe(true);
  });

  it('leaves savings out: only cash is assigned to categories', () => {
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
    expect(transactionTakesCategory('mortgage', false)).toBe(false);
    expect(transactionTakesCategory('tracking', false)).toBe(false);
  });

  it('never categorises savings', () => {
    expect(transactionTakesCategory('savings', false)).toBe(false);
  });
});
