// Backup object keys, in two shapes the destination chooses between:
//
//   `<YYYYMM>-<board-slug>.zip`   a month per file (S3, local)
//   `<board-slug>-latest.zip`     one file, overwritten (iCloud)
//
// Both are readable straight out of an S3 console or the Files app — you can
// see which board a file belongs to, and roughly when, without opening it. A
// month per file keeps the whole history on one screen and bounds it at
// twelve files a year; iCloud exists only to survive a reinstall, so it keeps
// a single current copy and spends none of the user's iCloud storage on
// history.
//
// Replaces a file per day in month folders, which piled up near-identical
// zips — a daily granularity nobody ever restored from — and before that
// `<boardId>/latest.zip`, whose numeric folders meant nothing to anyone
// reading the bucket. Both older shapes are still recognised for restore.

export const LEGACY_BACKUP_KEY = (boardId: number) => `${boardId}/latest.zip`;

export function slugifyBoardName(boardName: string): string {
  return boardName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'board';
}

export function backupKey(boardName: string, dateIso: string): string {
  return `${dateIso.replace(/-/g, '').slice(0, 6)}-${slugifyBoardName(boardName)}.zip`;
}

export function rollingBackupKey(boardName: string): string {
  return `${slugifyBoardName(boardName)}-latest.zip`;
}

// How recent a key is, as a fixed-width string that sorts lexicographically
// — or null when the key isn't this board's backup at all. A month file is
// rewritten all month long, so it ranks after every dated file from the same
// month an older version of the app left behind; `latest` ranks after any
// date, which is what it is — written after all of them.
function recencyToken(key: string, boardName: string): string | null {
  // Escaping isn't needed — the slug is already [a-z0-9-] only.
  const slug = slugifyBoardName(boardName);
  const monthly = key.match(new RegExp(`(^|/)(\\d{6})-${slug}\\.zip$`));
  if (monthly) return `${monthly[2]}99`;
  const dated = key.match(new RegExp(`(^|/)${slug}-(\\d{8}|latest)\\.zip$`));
  return dated ? dated[2] : null;
}

export function isBackupKeyForBoard(key: string, boardName: string): boolean {
  return recencyToken(key, boardName) !== null;
}

// The newest backup for one board — including, for a destination switched to
// the rolling key or to month files, whatever an older version wrote before.
export function latestBackupKey(keys: string[], boardName: string): string | null {
  const mine = keys
    .map((key) => ({ key, token: recencyToken(key, boardName) }))
    .filter((k): k is { key: string; token: string } => k.token !== null);
  if (mine.length === 0) return null;
  return mine.sort((a, b) => (a.token < b.token ? -1 : 1)).at(-1)!.key;
}
