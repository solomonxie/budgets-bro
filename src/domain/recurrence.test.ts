import { matchPreset, nextOccurrenceDate, ruleForPreset, MONDAY, THURSDAY, WEEKDAYS_MASK, WEEKEND_MASK } from './recurrence';

describe('nextOccurrenceDate', () => {
  it('steps daily by intervalN days', () => {
    expect(nextOccurrenceDate('2026-01-01', 'daily', 1)).toBe('2026-01-02');
    expect(nextOccurrenceDate('2026-01-01', 'daily', 3)).toBe('2026-01-04');
  });

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

  describe('weekly with a fixed set of weekdays', () => {
    // 2026-01-01 is a Thursday; anchoring there for these cases.
    const anchor = '2026-01-01';

    it('steps to the next selected weekday within the same week', () => {
      // Mon+Thu, every week, starting from Thursday the 1st — Monday the
      // 5th is next.
      expect(nextOccurrenceDate('2026-01-01', 'weekly', 1, MONDAY | THURSDAY, anchor)).toBe('2026-01-05');
    });

    it('wraps to the following week once this week is exhausted', () => {
      expect(nextOccurrenceDate('2026-01-05', 'weekly', 1, MONDAY | THURSDAY, anchor)).toBe('2026-01-08');
    });

    it('skips whole weeks for intervalN > 1, firing all selected days in an active week', () => {
      // Every 2 weeks on Mon+Thu, anchored on the Sunday that starts the
      // first active week (Dec 28 – Jan 3) — both days fire that week,
      // then skip a week entirely before the next pair.
      const sundayAnchor = '2025-12-28';
      expect(nextOccurrenceDate(sundayAnchor, 'weekly', 2, MONDAY | THURSDAY, sundayAnchor)).toBe('2025-12-29');
      expect(nextOccurrenceDate('2025-12-29', 'weekly', 2, MONDAY | THURSDAY, sundayAnchor)).toBe('2026-01-01');
      expect(nextOccurrenceDate('2026-01-01', 'weekly', 2, MONDAY | THURSDAY, sundayAnchor)).toBe('2026-01-12');
      expect(nextOccurrenceDate('2026-01-12', 'weekly', 2, MONDAY | THURSDAY, sundayAnchor)).toBe('2026-01-15');
    });

    it('falls back to plain weekly stepping when daysOfWeekMask is omitted', () => {
      expect(nextOccurrenceDate('2026-01-01', 'weekly', 1, null)).toBe('2026-01-08');
    });
  });
});

describe('recurrence presets', () => {
  it('round-trips every preset through matchPreset', () => {
    expect(matchPreset(ruleForPreset('daily'))).toBe('daily');
    expect(matchPreset(ruleForPreset('weekdays'))).toBe('weekdays');
    expect(matchPreset(ruleForPreset('weekends'))).toBe('weekends');
    expect(matchPreset(ruleForPreset('weekly'))).toBe('weekly');
    expect(matchPreset(ruleForPreset('biweekly'))).toBe('biweekly');
    expect(matchPreset(ruleForPreset('monthly'))).toBe('monthly');
    expect(matchPreset(ruleForPreset('every3Months'))).toBe('every3Months');
    expect(matchPreset(ruleForPreset('every6Months'))).toBe('every6Months');
    expect(matchPreset(ruleForPreset('yearly'))).toBe('yearly');
  });

  it('matches weekdays/weekends masks regardless of how they were built', () => {
    expect(matchPreset({ frequency: 'weekly', intervalN: 1, daysOfWeekMask: WEEKDAYS_MASK })).toBe('weekdays');
    expect(matchPreset({ frequency: 'weekly', intervalN: 1, daysOfWeekMask: WEEKEND_MASK })).toBe('weekends');
  });

  it('returns null for anything that needs the Custom label', () => {
    expect(matchPreset({ frequency: 'daily', intervalN: 5, daysOfWeekMask: null })).toBeNull();
    expect(matchPreset({ frequency: 'weekly', intervalN: 2, daysOfWeekMask: MONDAY | THURSDAY })).toBeNull();
    expect(matchPreset({ frequency: 'monthly', intervalN: 2, daysOfWeekMask: null })).toBeNull();
  });
});
