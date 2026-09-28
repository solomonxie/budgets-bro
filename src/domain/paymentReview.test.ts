import {
  applyReviewFilter,
  buildReviewItems,
  detectRecurring,
  decisionItemKey,
  defaultDueOn,
  nextQuarterStart,
  reviewOnAfterDecision,
  yearlyCents,
} from './paymentReview';
import type { ScheduledTransactionWithLabels } from './types';

const schedule = (over: Partial<ScheduledTransactionWithLabels>): ScheduledTransactionWithLabels => ({
  id: 1,
  accountId: 1,
  categoryId: null,
  payeeId: 7,
  memo: null,
  amountCents: -1000,
  frequency: 'monthly',
  intervalN: 1,
  daysOfWeekMask: null,
  nextDate: '2026-10-15',
  endDate: null,
  createdAt: '2025-09-01 10:00:00',
  reviewOn: null,
  reviewNote: null,
  reviewIgnored: false,
  payeeName: 'Streamy',
  categoryName: null,
  categoryIcon: null,
  accountName: 'Chequing',
  ...over,
});

describe('paymentReview', () => {
  it('annualizes by frequency and interval', () => {
    expect(yearlyCents(-1000, 'monthly', 1)).toBe(12000);
    expect(yearlyCents(-1000, 'monthly', 3)).toBe(4000);
    expect(yearlyCents(-12000, 'yearly', 1)).toBe(12000);
    expect(yearlyCents(-100, 'weekly', 1)).toBe(5200);
  });

  it('next quarter starts on Jan/Apr/Jul/Oct 1', () => {
    expect(nextQuarterStart('2026-01-01')).toBe('2026-04-01');
    expect(nextQuarterStart('2026-06-30')).toBe('2026-07-01');
    expect(nextQuarterStart('2026-09-28')).toBe('2026-10-01');
    expect(nextQuarterStart('2026-12-31')).toBe('2027-01-01');
  });

  it('lists outflows only, flags due, sorts by review date', () => {
    const items = buildReviewItems(
      [
        schedule({ id: 1 }),
        schedule({ id: 2, amountCents: 5000 }),
        schedule({ id: 3, frequency: 'yearly', amountCents: -9900, nextDate: '2026-10-10', payeeName: 'Cloud' }),
      ],
      [],
      '2026-09-28',
    );
    expect(items.map((i) => i.key)).toEqual(['s:3', 's:1']);
    expect(items.map((i) => i.cadence)).toEqual(['annual', 'monthly']);
    expect(items.map((i) => i.due)).toEqual([true, true]);
  });

  it('an item decided this quarter is marked decided until it comes due', () => {
    const items = buildReviewItems(
      [schedule({ id: 1, reviewOn: '2026-10-01' }), schedule({ id: 2, reviewOn: '2026-07-01' }), schedule({ id: 3, createdAt: '2026-09-01 10:00:00' })],
      [],
      '2026-09-28',
    );
    expect(items.map((i) => [i.key, i.decided, i.due])).toEqual([
      ['s:2', false, true],
      ['s:1', true, false],
      ['s:3', false, false],
    ]);
  });

  it('filter drops items whose payee or category is left out; empty keeps all', () => {
    const items = buildReviewItems(
      [schedule({ id: 1, payeeId: 7, categoryId: 20 }), schedule({ id: 2, payeeId: 8, categoryId: 21 }), schedule({ id: 3, payeeId: null, categoryId: null })],
      [],
      '2026-09-28',
    );
    const keys = (f: { payeeIds: number[]; categoryIds: number[] }) => applyReviewFilter(items, f).map((i) => i.key);
    expect(keys({ payeeIds: [], categoryIds: [] })).toEqual(['s:1', 's:2', 's:3']);
    expect(keys({ payeeIds: [7], categoryIds: [] })).toEqual(['s:2', 's:3']);
    expect(keys({ payeeIds: [], categoryIds: [21] })).toEqual(['s:1', 's:3']);
  });

  describe('detectRecurring', () => {
    const charge = (dates: string[], over = {}) => ({
      payeeId: 5,
      name: 'Music',
      amountCents: 1099,
      dates,
      categoryId: null,
      reviewOn: null,
      ignored: false,
      ...over,
    });
    const today = '2026-09-28';

    it('finds a monthly charge from three same-amount payments a month apart', () => {
      const [d] = detectRecurring([charge(['2026-07-03', '2026-08-03', '2026-09-03'])], today);
      expect(d).toMatchObject({ cadence: 'monthly', firstDate: '2026-07-03', nextDate: '2026-10-03' });
    });

    it('needs three monthly charges, not two', () => {
      expect(detectRecurring([charge(['2026-08-03', '2026-09-03'])], today)).toEqual([]);
    });

    it('finds an annual charge from two payments a year apart', () => {
      const [d] = detectRecurring([charge(['2024-11-10', '2025-11-10'])], today);
      expect(d).toMatchObject({ cadence: 'annual', nextDate: '2026-11-10' });
    });

    it('ignores irregular repeats and stopped subscriptions', () => {
      expect(detectRecurring([charge(['2026-01-05', '2026-01-20', '2026-06-01', '2026-09-10'])], today)).toEqual([]);
      expect(detectRecurring([charge(['2026-03-03', '2026-04-03', '2026-05-03'])], today)).toEqual([]);
    });

    it('detected items first come up the quarter after they started', () => {
      const detected = detectRecurring(
        [
          charge(['2025-08-03', '2025-09-03', '2025-10-03', '2025-11-03', '2025-12-03', '2026-01-03', '2026-09-03']),
          charge(['2024-10-20', '2025-10-20'], { payeeId: 6, amountCents: 5000 }),
        ],
        today,
      );
      const items = buildReviewItems([], detected, today);
      expect(items.map((i) => [i.key, i.cadence, i.reviewOn, i.due])).toEqual([
        ['d:6:5000', 'annual', '2025-01-01', true],
        ['d:5:1099', 'monthly', '2025-10-01', true],
      ]);
    });

    it('ignored items stay listed but are never due', () => {
      const detected = detectRecurring([charge(['2026-07-03', '2026-08-03', '2026-09-03'], { ignored: true })], today);
      const items = buildReviewItems([schedule({ reviewIgnored: true })], detected, today);
      expect(items.map((i) => [i.ignored, i.due])).toEqual([
        [true, false],
        [true, false],
      ]);
    });
  });

  describe('decisions', () => {
    const today = '2026-09-28';
    const items = buildReviewItems(
      [
        schedule({ id: 3, frequency: 'yearly', nextDate: '2026-10-10' }),
        schedule({ id: 4, nextDate: '2026-09-28' }),
      ],
      [],
      today,
    );
    const annual = items.find((i) => i.key === 's:3')!;
    const monthly = items.find((i) => i.key === 's:4')!;

    it('actions are due the day before the next charge, else in a week; alternatives in 30 days', () => {
      expect(defaultDueOn(annual, 'cancel', today)).toBe('2026-10-09');
      expect(defaultDueOn(monthly, 'convert', today)).toBe('2026-10-05');
      expect(defaultDueOn(annual, 'alternative', today)).toBe('2026-10-28');
    });

    it('a decision settles the item until next quarter', () => {
      expect(reviewOnAfterDecision(today)).toBe('2026-10-01');
      expect(reviewOnAfterDecision('2026-12-15')).toBe('2027-01-01');
    });

    it('a decision maps back to the item it was made for', () => {
      const base = { id: 1, name: 'x', amountCents: 1099, decision: 'cancel' as const, note: null, decidedOn: today, dueOn: null, doneOn: null };
      expect(decisionItemKey({ ...base, scheduleId: 4, payeeId: 7, cadence: 'monthly' })).toBe('s:4');
      expect(decisionItemKey({ ...base, scheduleId: null, payeeId: 7, cadence: 'monthly' })).toBe('d:7:1099');
    });
  });
});
