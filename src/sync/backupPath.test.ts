import { backupKey, isBackupKeyForBoard, latestBackupKey, slugifyBoardName } from './backupPath';

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
  it('is <YYYYMM>/<slug>-<YYYYMMDD>.zip', () => {
    expect(backupKey('Household Budget', '2026-09-15')).toBe('202609/household-budget-20260915.zip');
  });

  it('puts a January backup in that January folder', () => {
    expect(backupKey('Main', '2027-01-03')).toBe('202701/main-20270103.zip');
  });
});

describe('isBackupKeyForBoard', () => {
  it('matches its own board only', () => {
    expect(isBackupKeyForBoard('202609/main-20260915.zip', 'Main')).toBe(true);
    expect(isBackupKeyForBoard('202609/main-20260915.zip', 'Other')).toBe(false);
  });

  it('ignores anything that is not a dated backup', () => {
    expect(isBackupKeyForBoard('202609/main.zip', 'Main')).toBe(false);
    expect(isBackupKeyForBoard('1/latest.zip', 'Main')).toBe(false);
  });

  it('tolerates a configured key prefix in front of it', () => {
    expect(isBackupKeyForBoard('byobudget/202609/main-20260915.zip', 'Main')).toBe(true);
  });
});

describe('latestBackupKey', () => {
  const keys = [
    '202608/main-20260803.zip',
    '202609/main-20260915.zip',
    '202609/main-20260902.zip',
    '202610/holiday-fund-20261001.zip',
  ];

  it('picks the most recent one for the board', () => {
    expect(latestBackupKey(keys, 'Main')).toBe('202609/main-20260915.zip');
  });

  it('does not pick a newer file belonging to another board', () => {
    expect(latestBackupKey(keys, 'Holiday Fund')).toBe('202610/holiday-fund-20261001.zip');
  });

  it('returns null when the board has no backup', () => {
    expect(latestBackupKey(keys, 'Nothing Here')).toBeNull();
    expect(latestBackupKey([], 'Main')).toBeNull();
  });

  it('orders by date across a year boundary', () => {
    expect(latestBackupKey(['202701/main-20270102.zip', '202612/main-20261231.zip'], 'Main')).toBe(
      '202701/main-20270102.zip',
    );
  });
});
