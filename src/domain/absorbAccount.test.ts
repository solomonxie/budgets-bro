import { planAbsorb } from './absorbAccount';
import type { AbsorbRow } from './absorbAccount';

const CARD = 1;
const CHEQUING = 2;
const SAVINGS = 3;

describe('planAbsorb', () => {
  it('leaves the absorbing account square when every transfer was with it', () => {
    const rows: AbsorbRow[] = [
      // Spent on the card, categorised.
      { id: 10, accountId: CARD, transferAccountId: null, categoryId: 5, amountCents: -10_000 },
      // Paid the card off from chequing: two halves of one transfer.
      { id: 11, accountId: CARD, transferAccountId: CHEQUING, categoryId: null, amountCents: 10_000 },
      { id: 12, accountId: CHEQUING, transferAccountId: CARD, categoryId: null, amountCents: -10_000 },
    ];
    const plan = planAbsorb(rows, CARD, CHEQUING);
    expect(plan.moveIds).toEqual([10]);
    expect(plan.deleteIds.sort()).toEqual([11, 12]);
    // Chequing loses a -10,000 payment and gains -10,000 of spending.
    expect(plan.balanceDeltaCents).toBe(0);
    expect(plan.unassignedDeltaCents).toBe(0);
  });

  it('keeps category activity untouched, so Unassigned does not move', () => {
    const rows: AbsorbRow[] = [
      { id: 10, accountId: CARD, transferAccountId: null, categoryId: 5, amountCents: -10_000 },
      { id: 11, accountId: CARD, transferAccountId: CHEQUING, categoryId: null, amountCents: 10_000 },
      { id: 12, accountId: CHEQUING, transferAccountId: CARD, categoryId: null, amountCents: -10_000 },
    ];
    // The categorised row moves rather than being deleted — that is the
    // whole point, and why Unassigned stays put.
    expect(planAbsorb(rows, CARD, CHEQUING).moveIds).toContain(10);
  });

  it('reports the shortfall when a transfer was with some third account', () => {
    const rows: AbsorbRow[] = [
      { id: 10, accountId: CARD, transferAccountId: null, categoryId: 5, amountCents: -10_000 },
      // Paid from savings, but being absorbed into chequing: nothing on
      // chequing to cancel against, so it moves and shows up as a delta.
      { id: 11, accountId: CARD, transferAccountId: SAVINGS, categoryId: null, amountCents: 10_000 },
      { id: 12, accountId: SAVINGS, transferAccountId: CARD, categoryId: null, amountCents: -10_000 },
    ];
    const plan = planAbsorb(rows, CARD, CHEQUING);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.moveIds.sort()).toEqual([10, 11]);
    expect(plan.balanceDeltaCents).toBe(0);
  });

  it('ignores rows belonging to accounts not involved', () => {
    const rows: AbsorbRow[] = [
      { id: 10, accountId: CARD, transferAccountId: null, categoryId: 5, amountCents: -10_000 },
      { id: 20, accountId: SAVINGS, transferAccountId: null, categoryId: 7, amountCents: -500 },
    ];
    const plan = planAbsorb(rows, CARD, CHEQUING);
    expect(plan.moveIds).toEqual([10]);
    expect(plan.deleteIds).toEqual([]);
  });

  it('nets several payments and purchases to zero', () => {
    const rows: AbsorbRow[] = [
      { id: 1, accountId: CARD, transferAccountId: null, categoryId: 5, amountCents: -3_000 },
      { id: 2, accountId: CARD, transferAccountId: null, categoryId: 6, amountCents: -7_000 },
      { id: 3, accountId: CARD, transferAccountId: CHEQUING, categoryId: null, amountCents: 10_000 },
      { id: 4, accountId: CHEQUING, transferAccountId: CARD, categoryId: null, amountCents: -10_000 },
    ];
    expect(planAbsorb(rows, CARD, CHEQUING).balanceDeltaCents).toBe(0);
  });
});
