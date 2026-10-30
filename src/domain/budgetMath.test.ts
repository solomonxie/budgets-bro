import {
  accountBalanceCents,
  categoryBarSegments,
  categoryBalanceCents,
  categoryCaption,
  categoryFundedCents,
  categoryStatus,
  closePastMonths,
  overspentMonths,
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

  it('is funded by a carry-over alone, with nothing assigned this month', () => {
    expect(categoryStatus(8000, categoryFundedCents(8000, 0))).toBe('funded');
  });

  it('is fully spent when a carry-over was spent to zero', () => {
    expect(categoryStatus(0, categoryFundedCents(0, -5000))).toBe('fully-spent');
  });

  it('is funded by a refund alone', () => {
    expect(categoryStatus(1200, categoryFundedCents(1200, 1200))).toBe('funded');
  });
});

describe('closePastMonths', () => {
  const m = (month: string, assignedCents: number, activityCents: number) => ({
    month,
    assignedCents,
    activityCents,
  });

  it('trims an over-assigned month to what was spent and carries the rest', () => {
    expect(closePastMonths([m('2026-08', 20000, -15000)], '2026-10')).toEqual({
      assigned: [{ month: '2026-08', assignedCents: 15000 }],
      carryCents: 5000,
    });
  });

  it('covers an overspend from Unassigned instead of carrying a hole', () => {
    expect(closePastMonths([m('2026-09', 10000, -14000)], '2026-10')).toEqual({
      assigned: [{ month: '2026-09', assignedCents: 14000 }],
      carryCents: 0,
    });
  });

  it('lets an earlier leftover cover a later overspend', () => {
    const r = closePastMonths(
      [m('2026-07', 5000, -2000), m('2026-08', 0, -1000), m('2026-09', 0, -4000)],
      '2026-10',
    );
    expect(r.carryCents).toBe(0);
    expect(r.assigned).toEqual([
      { month: '2026-07', assignedCents: 2000 },
      { month: '2026-08', assignedCents: 1000 },
      { month: '2026-09', assignedCents: 4000 },
    ]);
  });

  it('turns a spend with no assignment into a covered month', () => {
    expect(closePastMonths([m('2026-09', 0, -2500)], '2026-10').assigned).toEqual([
      { month: '2026-09', assignedCents: 2500 },
    ]);
  });

  it('closes a refund month at a negative assignment and carries the refund', () => {
    expect(closePastMonths([m('2026-09', 0, 3000)], '2026-10')).toEqual({
      assigned: [{ month: '2026-09', assignedCents: -3000 }],
      carryCents: 3000,
    });
  });

  it('leaves the current and future months alone', () => {
    expect(
      closePastMonths([m('2026-10', 9000, -1000), m('2026-11', 5000, 0)], '2026-10'),
    ).toEqual({ assigned: [], carryCents: 0 });
  });

  it('does nothing the second time', () => {
    const months = [m('2026-08', 20000, -15000), m('2026-09', 0, -14000)];
    const first = closePastMonths(months, '2026-10');
    const closed = months.map((x) => ({
      ...x,
      assignedCents: first.assigned.find((a) => a.month === x.month)?.assignedCents ?? x.assignedCents,
    }));
    expect(closePastMonths(closed, '2026-10')).toEqual({ assigned: [], carryCents: 0 });
  });

  it('keeps every dollar: cash assigned changes only by the overspend covered', () => {
    const months = [m('2026-06', 30000, -10000), m('2026-07', 0, -25000), m('2026-08', 10000, -2000)];
    const r = closePastMonths(months, '2026-10');
    const before = months.reduce((s, x) => s + x.assignedCents, 0);
    const after = r.assigned.reduce((s, x) => s + x.assignedCents, 0) + r.carryCents;
    // June leaves 200, July overspends 250: 50 covered, August leaves 80.
    expect(r.carryCents).toBe(8000);
    expect(after - before).toBe(5000);
  });
});

describe('categoryCaption', () => {
  it('reports overspend amount', () => {
    expect(categoryCaption('overspent', 0, 15000, -4800)).toBe('Overspent by $48');
  });

  it('keeps the cents when a balance is under a dollar', () => {
    // A category at −40¢ is overspent, and rounding it to whole dollars
    // reported 'Overspent by $0' beside a red −$0 pill.
    expect(categoryCaption('overspent', 0, 15000, -40)).toBe('Overspent by $0.40');
    expect(categoryCaption('fully-spent', 199, 199, 0)).toBe('Fully spent $1.99');
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

describe('overspentMonths', () => {
  const months = (...rows: [string, number, number][]) =>
    rows.map(([month, assignedCents, activityCents]) => ({ month, assignedCents, activityCents }));

  it('is empty while the running balance stays positive', () => {
    expect(
      overspentMonths(months(['2026-06', 10_000, -4_000], ['2026-07', 0, -5_000])),
    ).toEqual([]);
  });

  it('names the month that broke, not the months that inherit the hole', () => {
    expect(
      overspentMonths(
        months(['2026-06', 10_000, -12_000], ['2026-07', 0, 0], ['2026-08', 0, 0]),
      ),
    ).toEqual([{ month: '2026-06', shortfallCents: 2_000 }]);
  });

  it('charges each month only with the deficit it added', () => {
    // June digs 30, July digs another 50 on top.
    expect(
      overspentMonths(months(['2026-06', 0, -3_000], ['2026-07', 0, -5_000])),
    ).toEqual([
      { month: '2026-06', shortfallCents: 3_000 },
      { month: '2026-07', shortfallCents: 5_000 },
    ]);
  });

  it('ignores a month that refills part of an older hole', () => {
    expect(
      overspentMonths(months(['2026-06', 0, -3_000], ['2026-07', 1_000, 0])),
    ).toEqual([{ month: '2026-06', shortfallCents: 3_000 }]);
  });

  it('reads months in order however they arrive', () => {
    expect(
      overspentMonths(months(['2026-07', 0, -1_000], ['2026-06', 500, 0])),
    ).toEqual([{ month: '2026-07', shortfallCents: 500 }]);
  });
});
