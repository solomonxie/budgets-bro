// Backup object keys: `<YYYYMMDD>-<board-slug>.zip`, one object per board per
// day, wherever the backup lands. Re-backing up the same day replaces that
// day's object; a history of near-identical zips is not a history.
//
// Date first so a bucket listing or a Files folder sorts itself
// chronologically, and the board named after it so you can see whose file it
// is without opening anything.
//
// What differs between destinations is retention, not the name: the OS cloud
// drive keeps the latest few and prunes (it's storage the user pays for), a
// bucket keeps everything (see CloudProvider.keepLatest). Earlier shapes —
// a file per month, `<slug>-latest.zip`, `<slug>-<YYYYMMDD>.zip` inside month
// folders, and `<boardId>/latest.zip` — are all still recognised for restore,
// since somebody's only copy may still be under one of them.

export const LEGACY_BACKUP_KEY = (boardId: number) => `${boardId}/latest.zip`;

export function slugifyBoardName(boardName: string): string {
  return boardName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'board';
}

export function backupKey(boardName: string, dateIso: string): string {
  return `${dateIso.replace(/-/g, '').slice(0, 8)}-${slugifyBoardName(boardName)}.zip`;
}

// How recent a key is, as a fixed-width string that sorts lexicographically
// — or null when the key isn't this board's backup at all. A legacy month
// file was rewritten all month long, so it ranks after every dated file from
// that month; `latest` ranks after any date, which is what it is — written
// after all of them.
function recencyToken(key: string, boardName: string): string | null {
  // Escaping isn't needed — the slug is already [a-z0-9-] only.
  const slug = slugifyBoardName(boardName);
  const dateFirst = key.match(new RegExp(`(^|/)(\\d{8})-${slug}\\.zip$`));
  if (dateFirst) return dateFirst[2];
  const monthly = key.match(new RegExp(`(^|/)(\\d{6})-${slug}\\.zip$`));
  if (monthly) return `${monthly[2]}99`;
  const dated = key.match(new RegExp(`(^|/)${slug}-(\\d{8}|latest)\\.zip$`));
  return dated ? dated[2] : null;
}

export function isBackupKeyForBoard(key: string, boardName: string): boolean {
  return recencyToken(key, boardName) !== null;
}

// This board's backups, newest last. Restore takes the last one; pruning
// takes everything before the tail it means to keep.
export function sortBackupKeys(keys: string[], boardName: string): string[] {
  return keys
    .map((key) => ({ key, token: recencyToken(key, boardName) }))
    .filter((k): k is { key: string; token: string } => k.token !== null)
    .sort((a, b) => (a.token < b.token ? -1 : 1))
    .map((k) => k.key);
}

// The newest backup for one board — including, for a destination still
// holding files an older version of the app wrote, whatever shape those are.
export function latestBackupKey(keys: string[], boardName: string): string | null {
  return sortBackupKeys(keys, boardName).at(-1) ?? null;
}

// Everything this destination should let go of to be left with `keepLatest`
// of this board's backups. Only ever this board's — another board's files,
// and anything that isn't a backup at all, are not ours to delete.
export function staleBackupKeys(keys: string[], boardName: string, keepLatest: number): string[] {
  const mine = sortBackupKeys(keys, boardName);
  return keepLatest <= 0 ? mine : mine.slice(0, Math.max(0, mine.length - keepLatest));
}
