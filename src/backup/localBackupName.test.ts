import {
  dailyBackupName,
  isBackupFileName,
  isPreDeletionBackupName,
  isStale,
  operationBackupName,
  preDeletionBackupName,
} from './localBackupName';

describe('dailyBackupName', () => {
  it('is one name per board, so it overwrites', () => {
    expect(dailyBackupName('Household Budget')).toBe('daily_household-budget.zip');
    expect(dailyBackupName('Household Budget')).toBe(dailyBackupName('household budget'));
  });
});

describe('operationBackupName', () => {
  it('names the operation it precedes, and sorts by when', () => {
    const name = operationBackupName('Household Budget', 'YNAB import', new Date('2026-09-18T07:38:09.123Z'));
    expect(name).toBe('20260918073809_before-ynab-import_household-budget.zip');
  });

  it('cannot collide with the daily file', () => {
    const at = new Date('2026-09-18T07:38:09Z');
    expect(operationBackupName('Budget', 'import', at)).not.toBe(dailyBackupName('Budget'));
  });

  it('is unique per operation within a day', () => {
    const a = operationBackupName('B', 'import', new Date('2026-09-18T07:38:09Z'));
    const b = operationBackupName('B', 'import', new Date('2026-09-18T09:12:00Z'));
    expect(a).not.toBe(b);
  });
});

describe('preDeletionBackupName', () => {
  const at = new Date('2026-09-24T20:30:05.500Z');

  it('is tagged pre-deletion and stamped', () => {
    expect(preDeletionBackupName('Household Budget', at)).toBe('20260924203005_pre-deletion_household-budget.zip');
  });

  it('never repeats across wipes a second apart', () => {
    const next = new Date(at.getTime() + 1000);
    expect(preDeletionBackupName('My Budget', next)).not.toBe(preDeletionBackupName('My Budget', at));
  });

  it('still recognises the older stamp', () => {
    expect(isPreDeletionBackupName('budget-pre-deletion-20260924T203005Z.zip')).toBe(true);
    expect(isPreDeletionBackupName('budget-pre-deletion-20260924203005.zip')).toBe(true);
  });

  it('is told apart from every other backup', () => {
    expect(isPreDeletionBackupName(preDeletionBackupName('Budget', at))).toBe(true);
    expect(isPreDeletionBackupName(operationBackupName('Budget', 'import', at))).toBe(false);
    expect(isPreDeletionBackupName(dailyBackupName('Budget'))).toBe(false);
    expect(isPreDeletionBackupName(dailyBackupName('pre-deletion'))).toBe(false);
  });
});

describe('isBackupFileName', () => {
  it('ignores anything that is not a zip', () => {
    expect(isBackupFileName('budget-daily.zip')).toBe(true);
    expect(isBackupFileName('.DS_Store')).toBe(false);
  });
});

describe('isStale', () => {
  const now = new Date('2026-09-18T12:00:00Z');

  it('keeps a month', () => {
    expect(isStale(new Date('2026-08-20T12:00:00Z'), now)).toBe(false);
    expect(isStale(new Date('2026-08-19T11:59:00Z'), now)).toBe(true);
  });

  it('keeps today', () => {
    expect(isStale(now, now)).toBe(false);
  });
});
