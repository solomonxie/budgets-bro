import { estimateInterestCents } from './interestEstimate';

const YEAR = { start: '2025-01-01', endExclusive: '2026-01-01' };

describe('estimateInterestCents', () => {
  it('earns the rate on a balance held all year', () => {
    expect(
      estimateInterestCents({ ...YEAR, balanceBeforeCents: 1_000_000, changes: [], rates: [{ date: '2020-01-01', bps: 300 }] }),
    ).toBe(30_000);
  });

  it('earns nothing before the first rate on file', () => {
    expect(
      estimateInterestCents({ ...YEAR, balanceBeforeCents: 1_000_000, changes: [], rates: [{ date: '2025-07-02', bps: 300 }] }),
    ).toBe(Math.round((1_000_000 * 0.03 * 183) / 365));
  });

  it('follows a rate change and a deposit from their day on', () => {
    const cents = estimateInterestCents({
      ...YEAR,
      balanceBeforeCents: 0,
      changes: [{ date: '2025-07-02', cents: 1_000_000 }],
      rates: [
        { date: '2024-01-01', bps: 200 },
        { date: '2025-10-01', bps: 400 },
      ],
    });
    expect(cents).toBe(Math.round((1_000_000 * (0.02 * 91 + 0.04 * 92)) / 365));
  });

  it('earns nothing on an overdrawn balance', () => {
    expect(
      estimateInterestCents({ ...YEAR, balanceBeforeCents: -50_000, changes: [], rates: [{ date: '2020-01-01', bps: 300 }] }),
    ).toBe(0);
  });
});
