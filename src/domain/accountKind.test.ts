import { ACCOUNT_KIND_ORDER, netWorth } from './accountKind';

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

  it('leaves income accounts out entirely', () => {
    const withIncome = netWorth([
      { type: 'cash', balanceCents: 100_000 },
      { type: 'income', balanceCents: 900_000 },
    ]);
    expect(withIncome.netWorthCents).toBe(100_000);
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
  it('puts Loan ahead of Asset and leaves Income last', () => {
    expect(ACCOUNT_KIND_ORDER.indexOf('Loan')).toBeLessThan(ACCOUNT_KIND_ORDER.indexOf('Asset'));
    expect(ACCOUNT_KIND_ORDER.at(-1)).toBe('Income');
  });
});
