import { dailyBackupName, isBackupFileName, isStale, operationBackupName } from './localBackupName';

describe('dailyBackupName', () => {
  it('is one name per board, so it overwrites', () => {
    expect(dailyBackupName('Household Budget')).toBe('household-budget-daily.zip');
    expect(dailyBackupName('Household Budget')).toBe(dailyBackupName('household budget'));
  });
});

describe('operationBackupName', () => {
  it('names the operation it precedes, and sorts by when', () => {
    const name = operationBackupName('Household Budget', 'YNAB import', new Date('2026-09-18T07:38:09.123Z'));
    expect(name).toBe('household-budget-before-ynab-import-20260918T073809Z.zip');
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
