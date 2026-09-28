import {
  buildReviewItems,
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
      '2026-09-28',
    );
    expect(items.map((i) => i.key)).toEqual(['s:1', 's:3', 'p:9']);
    expect(items.map((i) => i.cadence)).toEqual(['monthly', 'annual', 'adHoc']);
    expect(items.map((i) => i.due)).toEqual([true, true, false]);
  });
});
