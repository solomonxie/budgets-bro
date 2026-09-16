// Backup object keys: `<YYYYMM>/<board-slug>-<YYYYMMDD>.zip`
//
// Readable straight out of an S3 console or the Files app — you can see which
// board a file belongs to and when it was taken without opening it, and the
// month folders keep a long history browsable. One object per board per day:
// syncing repeatedly in a day overwrites that day's file rather than piling up
// near-identical zips.
//
// Replaces `<boardId>/latest.zip`, whose numeric folders meant nothing to
// anyone reading the bucket.

export const LEGACY_BACKUP_KEY = (boardId: number) => `${boardId}/latest.zip`;

export function slugifyBoardName(boardName: string): string {
  return boardName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'board';
}

export function backupKey(boardName: string, dateIso: string): string {
  const compact = dateIso.replace(/-/g, '');
  return `${compact.slice(0, 6)}/${slugifyBoardName(boardName)}-${compact}.zip`;
}

function keyPattern(boardName: string): RegExp {
  // Escaping isn't needed — the slug is already [a-z0-9-] only.
  return new RegExp(`(^|/)${slugifyBoardName(boardName)}-(\\d{8})\\.zip$`);
}

export function isBackupKeyForBoard(key: string, boardName: string): boolean {
  return keyPattern(boardName).test(key);
}

// The newest backup for one board. Keys sort lexicographically by date
// because the date is fixed-width and trails the slug, so the last match
// after sorting is the most recent one.
export function latestBackupKey(keys: string[], boardName: string): string | null {
  const mine = keys.filter((key) => isBackupKeyForBoard(key, boardName));
  if (mine.length === 0) return null;
  return mine.sort((a, b) => (a.match(keyPattern(boardName))![2] < b.match(keyPattern(boardName))![2] ? -1 : 1)).at(-1)!;
}
