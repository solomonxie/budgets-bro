import { paceToPayoff, paceToTarget, projectYearEnd } from './babyStepPace';

describe('paceToTarget', () => {
  it('is done once the target is reached', () => {
    expect(paceToTarget(100_000, 100_000, 5_000, '2026-09')).toEqual({
      kind: 'done',
    });
  });

  it('stalls when the balance is flat or falling', () => {
    expect(paceToTarget(0, 100_000, 0, '2026-09')).toEqual({ kind: 'stalled' });
    expect(paceToTarget(0, 100_000, -2_000, '2026-09')).toEqual({
      kind: 'stalled',
    });
  });

  it('rounds up to the month the target is crossed', () => {
    expect(paceToTarget(40_000, 100_000, 25_000, '2026-09')).toEqual({
      kind: 'eta',
      monthlyCents: 25_000,
      months: 3,
      doneBy: '2026-12',
    });
  });

  it('crosses year boundaries', () => {
    const pace = paceToTarget(0, 1_000_000, 100_000, '2026-09');
    expect(pace).toMatchObject({ months: 10, doneBy: '2027-07' });
  });

  it('gives up on a date past fifty years', () => {
    expect(paceToTarget(0, 10_000_000, 1_000, '2026-09')).toEqual({
      kind: 'far',
      monthlyCents: 1_000,
    });
  });
});

describe('paceToPayoff', () => {
  it('counts down what is owed', () => {
    expect(paceToPayoff(90_000, 30_000, '2026-09')).toMatchObject({
      kind: 'eta',
      months: 3,
    });
    expect(paceToPayoff(0, 30_000, '2026-09')).toEqual({ kind: 'done' });
  });
});

describe('projectYearEnd', () => {
  it('extends the year-to-date rate over twelve months', () => {
    expect(projectYearEnd(90_000, 9)).toBe(120_000);
    expect(projectYearEnd(5_000, 0)).toBe(5_000);
  });
});
