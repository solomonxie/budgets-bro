import { nextOccurrenceDate } from './recurrence';

describe('nextOccurrenceDate', () => {
  it('steps weekly by 7 days', () => {
    expect(nextOccurrenceDate('2026-01-01', 'weekly', 1)).toBe('2026-01-08');
  });

  it('steps weekly by intervalN weeks', () => {
    expect(nextOccurrenceDate('2026-01-01', 'weekly', 2)).toBe('2026-01-15');
  });

  it('steps monthly by one month', () => {
    expect(nextOccurrenceDate('2026-01-15', 'monthly', 1)).toBe('2026-02-15');
  });

  it('steps monthly by intervalN months', () => {
    expect(nextOccurrenceDate('2026-01-15', 'monthly', 3)).toBe('2026-04-15');
  });

  it('steps yearly by 12 months', () => {
    expect(nextOccurrenceDate('2026-03-10', 'yearly', 1)).toBe('2027-03-10');
  });

  it('treats a non-positive intervalN as 1', () => {
    expect(nextOccurrenceDate('2026-01-01', 'weekly', 0)).toBe('2026-01-08');
  });
});
