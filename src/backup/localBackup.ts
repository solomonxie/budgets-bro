import {
  documentDir,
  ensureDir,
  joinPath,
  listFiles,
  readBytes,
  removePath,
  writeBytes,
} from '../files/fileStore';
import type { SQLiteDatabase } from '../db/driver';
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
const DIR = joinPath(documentDir, 'Backups');

export interface LocalBackup {
  name: string;
  sizeBytes: number;
  modifiedAt: string; // ISO
}

async function dir(): Promise<string> {
  await ensureDir(DIR);
  return DIR;
}

export async function listLocalBackups(): Promise<LocalBackup[]> {
  const entries = await listFiles(await dir());
  return entries
    .filter((entry) => isBackupFileName(entry.name))
    .map((entry) => ({
      name: entry.name,
      sizeBytes: entry.sizeBytes,
      modifiedAt: entry.modifiedAt.toISOString(),
    }))
    .sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
}

export async function pruneLocalBackups(now = new Date()): Promise<number> {
  const entries = await listFiles(await dir());
  let removed = 0;
  for (const entry of entries) {
    if (!isBackupFileName(entry.name)) continue;
    if (!isStale(entry.modifiedAt, now)) continue;
    await removePath(entry.path);
    removed += 1;
  }
  return removed;
}

async function write(db: SQLiteDatabase, boardId: number, boardName: string, name: string): Promise<string> {
  const bytes = await buildBackupZip(db, boardId, boardName);
  await writeBytes(joinPath(await dir(), name), bytes);
  return name;
}

// The rolling copy — same gate as the .db snapshot (see useAutoSnapshot): on
// app-background, at most daily, and only if something changed.
export async function writeDailyBackup(db: SQLiteDatabase, boardId: number, boardName: string): Promise<string> {
  const name = await write(db, boardId, boardName, dailyBackupName(boardName));
  await pruneLocalBackups();
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
  return readBytes(joinPath(await dir(), name));
}

export async function deleteAllLocalBackups(): Promise<number> {
  const entries = await listFiles(await dir());
  let removed = 0;
  for (const entry of entries) {
    if (!isBackupFileName(entry.name)) continue;
    await removePath(entry.path);
    removed += 1;
  }
  return removed;
}
