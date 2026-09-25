import {
  backupKey,
  isBackupKeyForBoard,
  latestBackupKey,
  sanitizeBackupFileName,
  slugifyBoardName,
  sortBackupKeys,
  staleBackupKeys,
} from './backupPath';

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
  it('is <YYYYMMDD>_<purpose>_<slug>.zip', () => {
    expect(backupKey('Household Budget', '2026-09-15')).toBe('20260915_daily_household-budget.zip');
    expect(backupKey('Main', '2026-09-15', 'manual')).toBe('20260915_manual_main.zip');
  });

  it('is its board series, alongside the older date-first shape', () => {
    const keys = ['20260914-main.zip', backupKey('Main', '2026-09-15'), backupKey('Main', '2026-09-16', 'manual')];
    expect(latestBackupKey(keys, 'Main')).toBe('20260915_daily_main.zip');
    expect(staleBackupKeys(keys, 'Main', 1)).toEqual(['20260914-main.zip']);
  });

  it('is not claimed by a board whose name starts with daily', () => {
    expect(isBackupKeyForBoard(backupKey('Main', '2026-09-15'), 'Daily Main')).toBe(false);
  });

  it('is one file per day, so re-syncing the same day replaces it', () => {
    expect(backupKey('Main', '2026-09-30')).toBe(backupKey('Main', '2026-09-30'));
    expect(backupKey('Main', '2026-09-01')).not.toBe(backupKey('Main', '2026-09-30'));
    expect(backupKey('Main', '2027-01-03')).toBe('20270103_daily_main.zip');
  });
});

describe('isBackupKeyForBoard', () => {
  it('matches its own board only', () => {
    expect(isBackupKeyForBoard('20260915-main.zip', 'Main')).toBe(true);
    expect(isBackupKeyForBoard('20260915-main.zip', 'Other')).toBe(false);
  });

  it('ignores anything that is not a backup of ours', () => {
    expect(isBackupKeyForBoard('main.zip', 'Main')).toBe(false);
    expect(isBackupKeyForBoard('2026-main.zip', 'Main')).toBe(false);
    expect(isBackupKeyForBoard('1/latest.zip', 'Main')).toBe(false);
  });

  it('still matches every shape older versions wrote', () => {
    expect(isBackupKeyForBoard('202609-main.zip', 'Main')).toBe(true);
    expect(isBackupKeyForBoard('main-latest.zip', 'Main')).toBe(true);
    expect(isBackupKeyForBoard('202609/main-20260915.zip', 'Main')).toBe(true);
    expect(isBackupKeyForBoard('main-latest.zip', 'Other')).toBe(false);
  });

  it('tolerates a configured key prefix in front of it', () => {
    expect(isBackupKeyForBoard('budgetsbro/20260915-main.zip', 'Main')).toBe(true);
  });
});

describe('latestBackupKey', () => {
  const keys = ['20260814-main.zip', '20260915-main.zip', '20261002-holiday-fund.zip'];

  it('picks the most recent one for the board', () => {
    expect(latestBackupKey(keys, 'Main')).toBe('20260915-main.zip');
  });

  it('does not pick a newer file belonging to another board', () => {
    expect(latestBackupKey(keys, 'Holiday Fund')).toBe('20261002-holiday-fund.zip');
  });

  it('returns null when the board has no backup', () => {
    expect(latestBackupKey(keys, 'Nothing Here')).toBeNull();
    expect(latestBackupKey([], 'Main')).toBeNull();
  });

  it('orders across a year boundary', () => {
    expect(latestBackupKey(['20270103-main.zip', '20261231-main.zip'], 'Main')).toBe('20270103-main.zip');
  });

  it('prefers a legacy rolling key over everything dated — it was written last', () => {
    expect(latestBackupKey(['20260915-main.zip', 'main-latest.zip'], 'Main')).toBe('main-latest.zip');
  });

  it('ranks a legacy month file after that month\'s day files', () => {
    expect(latestBackupKey(['20260915-main.zip', '202609-main.zip'], 'Main')).toBe('202609-main.zip');
    expect(latestBackupKey(['202608-main.zip', '20260915-main.zip'], 'Main')).toBe('20260915-main.zip');
  });
});

describe('staleBackupKeys', () => {
  const keys = [
    '20260910-main.zip',
    '20260911-main.zip',
    '20260912-main.zip',
    '20260913-holiday-fund.zip',
    'notes.txt',
  ];

  it('gives up the oldest, keeping the newest N', () => {
    expect(staleBackupKeys(keys, 'Main', 2)).toEqual(['20260910-main.zip']);
  });

  it('keeps everything when there is room', () => {
    expect(staleBackupKeys(keys, 'Main', 10)).toEqual([]);
    expect(staleBackupKeys(keys, 'Main', 3)).toEqual([]);
  });

  it('never touches another board, or a file that is not a backup', () => {
    expect(staleBackupKeys(keys, 'Main', 0)).toEqual([
      '20260910-main.zip',
      '20260911-main.zip',
      '20260912-main.zip',
    ]);
  });

  it('sorts before slicing, whatever order the listing arrived in', () => {
    expect(staleBackupKeys(['20260912-main.zip', '20260910-main.zip', '20260911-main.zip'], 'Main', 1)).toEqual([
      '20260910-main.zip',
      '20260911-main.zip',
    ]);
  });
});

describe('sortBackupKeys', () => {
  it('is oldest first', () => {
    expect(sortBackupKeys(['20260912-main.zip', '20260910-main.zip'], 'Main')).toEqual([
      '20260910-main.zip',
      '20260912-main.zip',
    ]);
  });
});

describe('sanitizeBackupFileName', () => {
  it('keeps a typed name as typed, adding only the extension', () => {
    expect(sanitizeBackupFileName('Before the move', 'fallback.zip')).toBe('Before the move.zip');
    expect(sanitizeBackupFileName('already.ZIP', 'fallback.zip')).toBe('already.ZIP');
  });

  it('cannot name a folder or climb out of the one being browsed', () => {
    expect(sanitizeBackupFileName('../../etc/passwd', 'fallback.zip')).toBe('etc-passwd.zip');
    expect(sanitizeBackupFileName('a/b', 'fallback.zip')).toBe('a-b.zip');
  });

  it('falls back when nothing usable was typed', () => {
    expect(sanitizeBackupFileName('   ', 'fallback.zip')).toBe('fallback.zip');
    expect(sanitizeBackupFileName('...', 'fallback.zip')).toBe('fallback.zip');
  });
});
