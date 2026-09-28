import {
  buildReviewItems,
  detectRecurring,
  convertedAmountCents,
  firstReviewOn,
  nextMonthlyDateAfter,
  reviewOnAfterKeeping,
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

  it('first review: annual 30 days before renewal, else a year after creation', () => {
    expect(firstReviewOn('yearly', '2026-10-15', '2025-01-01')).toBe('2026-09-15');
    expect(firstReviewOn('monthly', '2026-10-15', '2025-09-01')).toBe('2026-09-01');
  });

  it('keeping an annual charge skips to before the following renewal', () => {
    expect(reviewOnAfterKeeping('yearly', '2026-10-15', '2026-09-20')).toBe('2027-09-15');
    expect(reviewOnAfterKeeping('monthly', '2026-10-15', '2026-09-20')).toBe('2027-09-20');
    expect(reviewOnAfterKeeping(null, null, '2026-09-20')).toBe('2027-09-20');
  });

  it('converts at equal yearly cost', () => {
    expect(convertedAmountCents(-1000, 'monthly', 1)).toBe(12000);
    expect(convertedAmountCents(-12000, 'yearly', 1)).toBe(1000);
  });

  it('next monthly date lands after today', () => {
    expect(nextMonthlyDateAfter('2026-06-10', '2026-09-28')).toBe('2026-10-10');
    expect(nextMonthlyDateAfter('2026-09-10', '2026-09-01')).toBe('2026-10-10');
  });

  it('lists outflows only, flags due, sorts by review date', () => {
    const items = buildReviewItems(
      [
        schedule({ id: 1 }),
        schedule({ id: 2, amountCents: 5000 }),
        schedule({ id: 3, frequency: 'yearly', amountCents: -9900, nextDate: '2026-10-10', payeeName: 'Cloud' }),
      ],
      [{ payeeId: 9, name: 'Gym', reviewOn: '2027-01-01', reviewNote: null, lastDate: '2026-08-01', lastAmountCents: 2000, yearCents: 6000 }],
      [],
      '2026-09-28',
    );
    expect(items.map((i) => i.key)).toEqual(['s:1', 's:3', 'p:9']);
    expect(items.map((i) => i.cadence)).toEqual(['monthly', 'annual', 'adHoc']);
    expect(items.map((i) => i.due)).toEqual([true, true, false]);
  });

  describe('detectRecurring', () => {
    const charge = (dates: string[], over = {}) => ({
      payeeId: 5,
      name: 'Music',
      amountCents: 1099,
      dates,
      reviewOn: null,
      reviewNote: null,
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

    it('detected items review a year after they started, annual ones before renewal', () => {
      const detected = detectRecurring(
        [
          charge(['2025-08-03', '2025-09-03', '2025-10-03', '2025-11-03', '2025-12-03', '2026-01-03', '2026-09-03']),
          charge(['2024-10-20', '2025-10-20'], { payeeId: 6, amountCents: 5000 }),
        ],
        today,
      );
      const items = buildReviewItems([], [], detected, today);
      expect(items.map((i) => [i.key, i.cadence, i.reviewOn, i.due])).toEqual([
        ['d:5:1099', 'monthly', '2026-08-03', true],
        ['d:6:5000', 'annual', '2026-09-20', true],
      ]);
    });
  });
});
