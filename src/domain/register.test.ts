import { computeBalanceCorrectionCents, withRunningBalances } from './register';

describe('withRunningBalances', () => {
  it('attaches balance-after for each transaction, walking backward from the ending balance', () => {
    const rows = withRunningBalances(
      [
        { id: 1, amountCents: -6218 },
        { id: 2, amountCents: -4100 },
        { id: 3, amountCents: 240000 },
      ],
      214532,
    );
    expect(rows.map((r) => r.runningBalanceCents)).toEqual([214532, 220750, 224850]);
  });

  it('handles an empty list', () => {
    expect(withRunningBalances([], 1000)).toEqual([]);
  });
});

describe('computeBalanceCorrectionCents', () => {
  it('is positive when the real balance is higher than computed', () => {
    expect(computeBalanceCorrectionCents(10000, 10500)).toBe(500);
  });

  it('is negative when the real balance is lower than computed', () => {
    expect(computeBalanceCorrectionCents(10000, 9500)).toBe(-500);
  });

  it('is zero when they already match', () => {
    expect(computeBalanceCorrectionCents(10000, 10000)).toBe(0);
  });
});
