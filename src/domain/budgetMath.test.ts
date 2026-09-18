import {
  accountBalanceCents,
  categoryBarSegments,
  categoryBalanceCents,
  categoryCaption,
  categoryStatus,
  unassignedCashCents,
} from './budgetMath';

describe('categoryBalanceCents', () => {
  it('rolls an unspent balance forward (cumulative, not per-month)', () => {
    // $50 assigned in month 1, nothing spent; by month 2 another $50
    // assigned with no more activity — cumulative should show $100 available.
    expect(categoryBalanceCents(5000, 0)).toBe(5000);
    expect(categoryBalanceCents(10000, 0)).toBe(10000);
  });

  it('subtracts cumulative activity', () => {
    expect(categoryBalanceCents(15000, -9800)).toBe(5200);
  });

  it('goes negative when overspent', () => {
    expect(categoryBalanceCents(15000, -19800)).toBe(-4800);
  });
});

describe('unassignedCashCents', () => {
  it('subtracts total assigned from total uncategorized amount', () => {
    expect(unassignedCashCents(50000, 20000)).toBe(30000);
  });

  it('a negative balance correction reduces unassigned cash, not just skipped', () => {
    // $500 in inflows, a -$50 correction found less cash than expected,
    // $200 assigned — net uncategorized is 500-50=450, minus 200 assigned.
    expect(unassignedCashCents(45000, 20000)).toBe(25000);
  });
});

describe('categoryStatus', () => {
  it('is overspent when balance is negative', () => {
    expect(categoryStatus(-100, 5000)).toBe('overspent');
  });

  it('is unbudgeted when nothing assigned this month', () => {
    expect(categoryStatus(0, 0)).toBe('unbudgeted');
  });

  it('is fully-spent when balance is exactly zero with an assignment', () => {
    expect(categoryStatus(0, 5000)).toBe('fully-spent');
  });

  it('is funded when balance is positive', () => {
    expect(categoryStatus(2000, 5000)).toBe('funded');
  });
});

describe('categoryCaption', () => {
  it('reports overspend amount', () => {
    expect(categoryCaption('overspent', 0, 15000, -4800)).toBe('Overspent by $48');
  });

  it('reports not budgeted', () => {
    expect(categoryCaption('unbudgeted', 0, 0, 0)).toBe('Not budgeted');
  });

  it('reports fully spent with the amount', () => {
    expect(categoryCaption('fully-spent', 5000, 5000, 0)).toBe('Fully spent $50');
  });

  it('reports funded with no spending', () => {
    expect(categoryCaption('funded', 0, 5000, 5000)).toBe('Funded');
  });

  it('reports spent-of-assigned when partially spent', () => {
    expect(categoryCaption('funded', 4000, 15000, 11000)).toBe('Spent $40 of $150');
  });
});

describe('accountBalanceCents', () => {
  it('sums opening balance and all transactions', () => {
    expect(accountBalanceCents(0, [240000, -6218, -4100])).toBe(229682);
  });

  it('handles no transactions', () => {
    expect(accountBalanceCents(5000, [])).toBe(5000);
  });
});

describe('categoryBarSegments', () => {
  it('splits by the real ratio', () => {
    // $50 spent of a $100 envelope: half and half.
    expect(categoryBarSegments(5000, 5000)).toEqual({ spentPercent: 50, remainingPercent: 50 });
  });

  it('is all remaining when funded and untouched', () => {
    expect(categoryBarSegments(10000, 0)).toEqual({ spentPercent: 0, remainingPercent: 100 });
  });

  it('is all spent when the envelope is empty', () => {
    expect(categoryBarSegments(0, 10000)).toEqual({ spentPercent: 100, remainingPercent: 0 });
  });

  it('measures against balance plus spent, so a rollover reads truthfully', () => {
    // Assigned nothing this month, carried $75 in, spent $25 — a quarter
    // gone, not "100% of this month's assignment".
    expect(categoryBarSegments(7500, 2500)).toEqual({ spentPercent: 25, remainingPercent: 75 });
  });

  it('has nothing to draw when nothing is assigned or spent', () => {
    expect(categoryBarSegments(0, 0)).toEqual({ spentPercent: 0, remainingPercent: 0 });
  });

  it('treats an overspent balance as nothing remaining', () => {
    // The caller colours this one whole; there is no remainder to show.
    expect(categoryBarSegments(-2000, 10000)).toEqual({ spentPercent: 100, remainingPercent: 0 });
  });
});
