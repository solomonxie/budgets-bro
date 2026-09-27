// Backup object keys: `<YYYYMMDD>_daily_<board-slug>.zip`, one object per
// board per day, wherever the backup lands. When, why, whose — the same
// order as the local files (backup/localBackupName.ts). Re-backing up the same day replaces that
// day's object; a history of near-identical zips is not a history.
//
// Date first so a bucket listing or a Files folder sorts itself
// chronologically, and the board named after it so you can see whose file it
// is without opening anything.
//
// What differs between destinations is retention, not the name: the OS cloud
// drive keeps the latest few and prunes (it's storage the user pays for), a
// bucket keeps everything (see CloudProvider.keepLatest). Earlier shapes —
// `<YYYYMMDD>-<slug>.zip`, a file per month, `<slug>-latest.zip`, `<slug>-<YYYYMMDD>.zip` inside month
// folders, and `<boardId>/latest.zip` — are all still recognised for restore,
// since somebody's only copy may still be under one of them.

export const LEGACY_BACKUP_KEY = (boardId: number) => `${boardId}/latest.zip`;

export function slugifyBoardName(boardName: string): string {
  return boardName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'board';
}

// Only 'daily' is recognised below as this board's series — anything else
// (a manual copy) is never pruned or picked for restore.
export function backupKey(boardName: string, dateIso: string, purpose = 'daily'): string {
  return `${dateIso.replace(/-/g, '').slice(0, 8)}_${purpose}_${slugifyBoardName(boardName)}.zip`;
}

// How recent a key is, as a fixed-width string that sorts lexicographically
// — or null when the key isn't this board's backup at all. A legacy month
// file was rewritten all month long, so it ranks after every dated file from
// that month; `latest` ranks after any date, which is what it is — written
// after all of them.
function recencyToken(key: string, boardName: string): string | null {
  // Escaping isn't needed — the slug is already [a-z0-9-] only.
  const slug = slugifyBoardName(boardName);
  const current = key.match(new RegExp(`(^|/)(\\d{8})_daily_${slug}\\.zip$`));
  if (current) return current[2];
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
// of this board's backups, plus the newest one of each of the last
// `keepMonths` months — so a mistake noticed weeks late still has a copy from
// before it. Only ever this board's — another board's files, and anything
// that isn't a backup at all, are not ours to delete.
export function staleBackupKeys(keys: string[], boardName: string, keepLatest: number, keepMonths = 0): string[] {
  const mine = keys
    .map((key) => ({ key, token: recencyToken(key, boardName) }))
    .filter((k): k is { key: string; token: string } => k.token !== null)
    .sort((a, b) => (a.token < b.token ? -1 : 1));
  const keep = new Set(keepLatest <= 0 ? [] : mine.slice(-keepLatest).map((k) => k.key));
  const monthsSeen = new Set<string>();
  for (let i = mine.length - 1; i >= 0 && monthsSeen.size < keepMonths; i--) {
    const month = mine[i].token.slice(0, 6);
    if (!/^\d{6}$/.test(month) || monthsSeen.has(month)) continue;
    monthsSeen.add(month);
    keep.add(mine[i].key);
  }
  return mine.filter((k) => !keep.has(k.key)).map((k) => k.key);
}

// The name each board's backups go under. Two boards whose names slug the
// same would overwrite each other's file, so every one after the first gets
// its id appended.
export function backupNamesForBoards(boards: { id: number; name: string }[]): Map<number, string> {
  const names = new Map<number, string>();
  const taken = new Set<string>();
  for (const board of [...boards].sort((a, b) => a.id - b.id)) {
    const slug = slugifyBoardName(board.name);
    const name = taken.has(slug) ? `${board.name}-${board.id}` : board.name;
    taken.add(slugifyBoardName(name));
    names.set(board.id, name);
  }
  return names;
}

// The newest automatic backup per board slug, for finding everything worth
// restoring after a reinstall. Manual and pre-deletion copies are left out:
// they are named by hand or taken at a moment, not the board's latest state.
export function latestKeyPerBoard(keys: string[]): string[] {
  const newest = new Map<string, { key: string; date: string }>();
  for (const key of keys) {
    const m = key.match(/(?:^|\/)(\d{8})(?:_daily_|-)([a-z0-9-]+)\.zip$/);
    if (!m) continue;
    const [, date, slug] = m;
    const current = newest.get(slug);
    if (!current || date > current.date) newest.set(slug, { key, date });
  }
  return [...newest.values()].map((v) => v.key);
}

// A name typed by hand in a browser's "back up here", made safe to use as a
// key: no slashes (the name goes under the folder being browsed, it doesn't
// pick its own), no leading dots, always .zip, never empty. Not the same job
// as slugifyBoardName — this one keeps what was typed, spaces and all, since
// the user is naming a file they will read later.
export function sanitizeBackupFileName(name: string, fallback: string): string {
  const base = name
    .replace(/[\\/]+/g, '-')
    .replace(/^[.\-\s]+/, '')
    .trim()
    .slice(0, 120);
  if (base === '') return fallback;
  return /\.zip$/i.test(base) ? base : `${base}.zip`;
}
