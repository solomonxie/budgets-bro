import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { buildBackupZip } from '../sync/buildBackup';
import { dailyBackupName, isBackupFileName, isStale, operationBackupName } from './localBackupName';

// Tier 1: the copy that lives on the phone, in the app's own Documents
// folder, where the Files app can see it ("On My iPhone → Budgets Bro →
// Backups").
//
// It does not survive deleting the app — nothing in this sandbox does — and
// that is not what it is for. It answers the other failure, the common one:
// the data is still there and is now wrong. It is instant, needs no network,
// no iCloud account and no bucket, and it is the only copy you can hand to
// someone else by dragging it out in Files.
//
// Retention is by age (see localBackupName.MAX_AGE_DAYS), not by count.
const DIR = 'Backups';

export interface LocalBackup {
  name: string;
  sizeBytes: number;
  modifiedAt: string; // ISO
}

function dir(): Directory {
  const d = new Directory(Paths.document, DIR);
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

function modifiedAt(file: File): Date {
  // Milliseconds since the epoch, and absent on a file the platform won't
  // stat — treat that as brand new rather than as stale, so a missing
  // timestamp can never be the reason a backup is deleted.
  const ms = file.lastModified;
  return ms == null ? new Date() : new Date(ms);
}

export function listLocalBackups(): LocalBackup[] {
  return dir()
    .list()
    .flatMap((entry) =>
      entry instanceof File && isBackupFileName(entry.name)
        ? [{ name: entry.name, sizeBytes: entry.size ?? 0, modifiedAt: modifiedAt(entry).toISOString() }]
        : [],
    )
    .sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
}

export function pruneLocalBackups(now = new Date()): number {
  const d = dir();
  let removed = 0;
  for (const entry of d.list()) {
    if (!(entry instanceof File) || !isBackupFileName(entry.name)) continue;
    if (!isStale(modifiedAt(entry), now)) continue;
    entry.delete();
    removed += 1;
  }
  return removed;
}

async function write(db: SQLiteDatabase, boardId: number, boardName: string, name: string): Promise<string> {
  const bytes = await buildBackupZip(db, boardId, boardName);
  const file = new File(dir(), name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return name;
}

// The rolling copy — same gate as the .db snapshot (see useAutoSnapshot): on
// app-background, at most daily, and only if something changed.
export async function writeDailyBackup(db: SQLiteDatabase, boardId: number, boardName: string): Promise<string> {
  const name = await write(db, boardId, boardName, dailyBackupName(boardName));
  pruneLocalBackups();
  return name;
}

// Called before an import, a bulk relabel, a restore — anything that rewrites
// many rows at once. Kept under its own name so the daily overwrite can't eat
// it. Returns null rather than throwing: this is insurance, and it must never
// be the reason an operation the user asked for doesn't happen.
export async function writeOperationBackup(
  db: SQLiteDatabase,
  boardId: number,
  boardName: string,
  op: string,
): Promise<string | null> {
  try {
    const name = await write(db, boardId, boardName, operationBackupName(boardName, op, new Date()));
    pruneLocalBackups();
    return name;
  } catch (e) {
    console.warn('[localBackup] operation backup failed', e);
    return null;
  }
}

export async function readLocalBackup(name: string): Promise<Uint8Array | null> {
  const file = new File(dir(), name);
  return file.exists ? file.bytes() : null;
}

export function deleteAllLocalBackups(): number {
  const d = dir();
  let removed = 0;
  for (const entry of d.list()) {
    if (entry instanceof File && isBackupFileName(entry.name)) {
      entry.delete();
      removed += 1;
    }
  }
  return removed;
}
