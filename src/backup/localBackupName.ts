import { slugifyBoardName } from '../sync/backupPath';

// Tier-1 filenames, kept apart from the file I/O so the naming and the
// pruning rule can be tested without a filesystem.
//
// Three kinds of file live in this folder and they are pruned differently,
// so they must be told apart by name alone:
//
//   daily_home-budget.zip                           the rolling copy, overwritten
//   <stamp>_before-ynab-import_home-budget.zip      before one big operation
//   <stamp>_pre-deletion_home-budget.zip            before Remove all app data
//
// When, then why, then whose — `_` between them since a slug has `-` in it.
// The daily copy has no stamp: it is one file, rewritten.
//
// The operation kind is the one that actually gets used. A bad import is the
// failure people hit, and it lands minutes after the day's rolling copy
// already captured the good state — or hours after, having captured nothing.

const SUFFIX = '.zip';

export function dailyBackupName(boardName: string): string {
  return `daily_${slugifyBoardName(boardName)}${SUFFIX}`;
}

// `op` names what the file precedes, not what it contains: you read it when
// looking for "the one from before I imported YNAB".
export function operationBackupName(boardName: string, op: string, at: Date): string {
  return `${stamp(at)}_before-${slugifyBoardName(op)}_${slugifyBoardName(boardName)}${SUFFIX}`;
}

// Written by Remove all app data, which then deletes every other backup —
// so these are the one kind neither that wipe nor age pruning touches.
export function preDeletionBackupName(boardName: string, at: Date): string {
  return `${stamp(at)}_pre-deletion_${slugifyBoardName(boardName)}${SUFFIX}`;
}

// Also matches the older `<slug>-pre-deletion-<stamp>` names, so copies
// already on the device stay protected.
export function isPreDeletionBackupName(name: string): boolean {
  return /^\d{14}_pre-deletion_.+\.zip$/.test(name) || /-pre-deletion-\d{8}T?\d{6}Z?\.zip$/.test(name);
}

// YYYYmmddHHMMSS, UTC, so a DST fall-back hour can't repeat a name.
function stamp(at: Date): string {
  return at.toISOString().replace(/\D/g, '').slice(0, 14);
}

export function isBackupFileName(name: string): boolean {
  return name.endsWith(SUFFIX);
}

// Pruned by age, not by count: once an operation can add a file, a count
// silently caps how many imports you get in a day before it starts eating
// yesterday. "Anything from the last month" is a promise that stays true
// however busy the month was — a week was short enough that damage nobody
// noticed for a fortnight had already aged out of every local copy.
export const MAX_AGE_DAYS = 30;

export function isStale(modifiedAt: Date, now: Date, maxAgeDays = MAX_AGE_DAYS): boolean {
  return now.getTime() - modifiedAt.getTime() > maxAgeDays * 24 * 60 * 60 * 1000;
}
