import { lastNMonths, nextMonth, previousMonth, yearsBetween } from './month';

describe('nextMonth', () => {
  it('advances within a year', () => {
    expect(nextMonth('2026-09')).toBe('2026-10');
  });

  it('rolls over into January', () => {
    expect(nextMonth('2026-12')).toBe('2027-01');
  });
});

describe('previousMonth', () => {
  it('goes back within a year', () => {
    expect(previousMonth('2026-09')).toBe('2026-08');
  });

  it('rolls back into December', () => {
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});

describe('lastNMonths', () => {
  it('returns n months ending at the given month, oldest first', () => {
    expect(lastNMonths('2026-09', 4)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('handles a year boundary', () => {
    expect(lastNMonths('2026-01', 3)).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('yearsBetween', () => {
  it('is inclusive at both ends', () => {
    expect(yearsBetween('2024', '2026')).toEqual(['2024', '2025', '2026']);
  });

  it('returns the single year when start and end match', () => {
    expect(yearsBetween('2026', '2026')).toEqual(['2026']);
  });

  it('falls back to the end year when the range is inverted', () => {
    expect(yearsBetween('2027', '2026')).toEqual(['2026']);
  });
});
