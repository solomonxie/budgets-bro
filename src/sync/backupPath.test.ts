import { backupKey, isBackupKeyForBoard, latestBackupKey, rollingBackupKey, slugifyBoardName } from './backupPath';

describe('slugifyBoardName', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyBoardName('Household Budget')).toBe('household-budget');
  });

  it('collapses punctuation and trims stray hyphens', () => {
    expect(slugifyBoardName("  Sol's  Money / 2026!  ")).toBe('sol-s-money-2026');
  });

  it('falls back to "board" when nothing survives', () => {
    expect(slugifyBoardName('家庭预算')).toBe('board');
    expect(slugifyBoardName('   ')).toBe('board');
  });
});

describe('backupKey', () => {
  it('is <YYYYMM>-<slug>.zip', () => {
    expect(backupKey('Household Budget', '2026-09-15')).toBe('202609-household-budget.zip');
  });

  it('is one file for the whole month, whatever day it is synced', () => {
    expect(backupKey('Main', '2026-09-01')).toBe(backupKey('Main', '2026-09-30'));
    expect(backupKey('Main', '2027-01-03')).toBe('202701-main.zip');
  });
});

describe('rollingBackupKey', () => {
  it('is one file per board, with no date to make it a new one', () => {
    expect(rollingBackupKey('Household Budget')).toBe('household-budget-latest.zip');
    expect(rollingBackupKey('Household Budget')).toBe(rollingBackupKey('household budget'));
  });
});

describe('isBackupKeyForBoard', () => {
  it('matches its own board only', () => {
    expect(isBackupKeyForBoard('202609-main.zip', 'Main')).toBe(true);
    expect(isBackupKeyForBoard('202609-main.zip', 'Other')).toBe(false);
  });

  it('ignores anything that is not a backup of ours', () => {
    expect(isBackupKeyForBoard('main.zip', 'Main')).toBe(false);
    expect(isBackupKeyForBoard('2026-main.zip', 'Main')).toBe(false);
    expect(isBackupKeyForBoard('1/latest.zip', 'Main')).toBe(false);
  });

  it('matches the rolling key too', () => {
    expect(isBackupKeyForBoard('main-latest.zip', 'Main')).toBe(true);
    expect(isBackupKeyForBoard('main-latest.zip', 'Other')).toBe(false);
  });

  it('still matches the day-per-file keys older versions wrote', () => {
    expect(isBackupKeyForBoard('202609/main-20260915.zip', 'Main')).toBe(true);
  });

  it('tolerates a configured key prefix in front of it', () => {
    expect(isBackupKeyForBoard('byobudget/202609-main.zip', 'Main')).toBe(true);
  });
});

describe('latestBackupKey', () => {
  const keys = [
    '202608-main.zip',
    '202609-main.zip',
    '202610-holiday-fund.zip',
  ];

  it('picks the most recent one for the board', () => {
    expect(latestBackupKey(keys, 'Main')).toBe('202609-main.zip');
  });

  it('does not pick a newer file belonging to another board', () => {
    expect(latestBackupKey(keys, 'Holiday Fund')).toBe('202610-holiday-fund.zip');
  });

  it('returns null when the board has no backup', () => {
    expect(latestBackupKey(keys, 'Nothing Here')).toBeNull();
    expect(latestBackupKey([], 'Main')).toBeNull();
  });

  it('prefers the rolling key over everything dated', () => {
    expect(latestBackupKey(['202609-main.zip', 'main-latest.zip'], 'Main')).toBe('main-latest.zip');
  });

  it('prefers this month\'s file over a day file from the same month', () => {
    expect(latestBackupKey(['202609/main-20260915.zip', '202609-main.zip'], 'Main')).toBe('202609-main.zip');
  });

  it('still picks a newer day file an older version wrote', () => {
    expect(latestBackupKey(['202608-main.zip', '202609/main-20260915.zip'], 'Main')).toBe(
      '202609/main-20260915.zip',
    );
  });

  it('orders across a year boundary', () => {
    expect(latestBackupKey(['202701-main.zip', '202612-main.zip'], 'Main')).toBe('202701-main.zip');
  });
});
