import { slugifyBoardName } from '../sync/backupPath';

// Tier-1 filenames, kept apart from the file I/O so the naming and the
// pruning rule can be tested without a filesystem.
//
// Two kinds of file live in this folder and they are pruned differently, so
// they must be told apart by name alone:
//
//   home-budget-daily.zip                  the rolling copy, overwritten
//   home-budget-before-import-<stamp>.zip  written before one big operation
//
// The second kind is the one that actually gets used. A bad import is the
// failure people hit, and it lands minutes after the day's rolling copy
// already captured the good state — or hours after, having captured nothing.

const SUFFIX = '.zip';

export function dailyBackupName(boardName: string): string {
  return `${slugifyBoardName(boardName)}-daily${SUFFIX}`;
}

// `op` names what the file precedes, not what it contains: you read it when
// looking for "the one from before I imported YNAB".
export function operationBackupName(boardName: string, op: string, at: Date): string {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `${slugifyBoardName(boardName)}-before-${slugifyBoardName(op)}-${stamp}${SUFFIX}`;
}

export function isBackupFileName(name: string): boolean {
  return name.endsWith(SUFFIX);
}

// Pruned by age, not by count: once an operation can add a file, a count
// silently caps how many imports you get in a day before it starts eating
// yesterday. "Anything from the last week" is a promise that stays true
// however busy the week was.
export const MAX_AGE_DAYS = 7;

export function isStale(modifiedAt: Date, now: Date, maxAgeDays = MAX_AGE_DAYS): boolean {
  return now.getTime() - modifiedAt.getTime() > maxAgeDays * 24 * 60 * 60 * 1000;
}
