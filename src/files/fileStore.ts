import FileStore from '../../modules/file-store';
import { base64ToBytes, bytesToBase64 } from './bytes';

// The handful of file operations this app actually does, in one place.
//
// It exists because the filesystem layer underneath changed twice (expo-file-
// system, then a community library, now the app's own FileStore module) and
// every caller shouldn't have to. The
// shape is deliberately narrow — paths in, bytes out — rather than a
// File/Directory object model: nothing here needs more than that, and the
// last abstraction's objects were what made swapping it out a day's work.
//
// Everything is async. The old API was synchronous, which reads nicely but
// isn't a property worth keeping: it blocked the JS thread on every backup
// listing and snapshot copy.

export const documentDir = FileStore?.documentDir ?? '';
export const cacheDir = FileStore?.cacheDir ?? '';

export function joinPath(...parts: string[]): string {
  return parts.join('/');
}

// For the share sheet and anything else that takes a URL rather than a path.
export function fileUrl(path: string): string {
  return `file://${path}`;
}

export interface FileEntry {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: Date;
}

export async function pathExists(path: string): Promise<boolean> {
  return FileStore.exists(path);
}

export async function ensureDir(path: string): Promise<void> {
  await FileStore.mkdir(path);
}

// Files only — every caller here is looking for backups or snapshots, never
// for the folders they might sit in. A directory that doesn't exist reads as
// empty rather than throwing: "nothing backed up yet" and "no folder yet"
// are the same answer to the only question being asked.
export async function listFiles(dir: string): Promise<FileEntry[]> {
  if (!(await FileStore.exists(dir))) return [];
  const entries = await FileStore.readDir(dir);
  return entries
    .filter((entry) => entry.isFile)
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      sizeBytes: entry.size,
      // A file the platform won't stat is treated as brand new rather than
      // stale, so a missing timestamp can never be why a backup is deleted.
      modifiedAt: entry.mtime != null ? new Date(entry.mtime) : new Date(),
    }));
}

export async function readBytes(path: string): Promise<Uint8Array | null> {
  if (!(await FileStore.exists(path))) return null;
  return base64ToBytes(await FileStore.readBase64(path));
}

export async function writeBytes(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  await FileStore.writeBase64(path, bytesToBase64(bytes));
}

export async function removePath(path: string): Promise<void> {
  await FileStore.remove(path);
}

export async function copyPath(from: string, to: string): Promise<void> {
  // FileManager refuses to overwrite, so clear the way first — every copy
  // here is "make this the current one", never "add alongside".
  await removePath(to);
  await FileStore.copy(from, to);
}

export async function movePath(from: string, to: string): Promise<void> {
  await removePath(to);
  await FileStore.move(from, to);
}
