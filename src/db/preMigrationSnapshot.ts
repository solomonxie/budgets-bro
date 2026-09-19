import {
  copyPath,
  documentDir,
  ensureDir,
  joinPath,
  listFiles,
  pathExists,
  removePath,
} from '../files/fileStore';

const SQLITE_DIR = joinPath(documentDir, 'SQLite');
const SNAPSHOT_DIR = joinPath(documentDir, 'db-snapshots');
// Enough to get back past a bad release without turning the phone into an
// archive — a fortnight or so once daily ones are in the mix. Oldest first.
const KEEP = 14;

export interface DbSnapshot {
  name: string;
  fromVersion: number;
  toVersion: number;
  takenAt: string; // ISO
  sizeBytes: number;
}

async function snapshotDir(): Promise<string> {
  await ensureDir(SNAPSHOT_DIR);
  return SNAPSHOT_DIR;
}

function parse(name: string): DbSnapshot | null {
  // v<from>-to-v<to>-<iso>.db
  const m = name.match(/^v(\d+)-to-v(\d+)-(.+)\.db$/);
  if (!m) return null;
  return {
    name,
    fromVersion: Number(m[1]),
    toVersion: Number(m[2]),
    takenAt: m[3].replace(/_/g, ':'),
    sizeBytes: 0,
  };
}

export async function listSnapshots(): Promise<DbSnapshot[]> {
  const entries = await listFiles(await snapshotDir());
  return entries
    .flatMap((entry) => {
      const snapshot = parse(entry.name);
      return snapshot ? [{ ...snapshot, sizeBytes: entry.sizeBytes }] : [];
    })
    .sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
}

// Copies the database aside before a migration that will change existing
// rows. Local, so it needs no network and no cloud destination configured,
// and it happens before the change rather than depending on a backup that
// may already have been overwritten by a sync.
//
// The point is data migrations specifically — a migration that only adds a
// column can't lose anything, while one that rewrites or clears rows can,
// and the old values are gone the moment it commits. Copying the whole
// database is crude but has the property that matters: whatever the
// migration was about to get wrong, this file still has it right.
//
// WAL matters here: recent commits may still be in budgetsbro.db-wal rather
// than the main file, so the sidecars are copied too — a copy of only the
// main file can be missing the newest writes.
export async function takeSnapshot(
  dbName: string,
  fromVersion: number,
  toVersion: number,
): Promise<DbSnapshot | null> {
  const source = joinPath(SQLITE_DIR, dbName);
  if (!(await pathExists(source))) return null;

  const takenAt = new Date().toISOString().replace(/:/g, '_');
  const base = `v${fromVersion}-to-v${toVersion}-${takenAt}`;
  const dir = await snapshotDir();
  await copyPath(source, joinPath(dir, `${base}.db`));
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = joinPath(SQLITE_DIR, `${dbName}${suffix}`);
    if (await pathExists(sidecar))
      await copyPath(sidecar, joinPath(dir, `${base}.db${suffix}`));
  }

  await prune();
  return parse(`${base}.db`);
}

async function prune(): Promise<void> {
  const dir = await snapshotDir();
  const snapshots = await listSnapshots();
  for (const stale of snapshots.slice(KEEP)) {
    for (const suffix of ['', '-wal', '-shm']) {
      await removePath(joinPath(dir, `${stale.name}${suffix}`));
    }
  }
}

// Puts a snapshot back as the live database. The caller is responsible for
// making sure nothing holds an open connection — in practice this means
// restarting the app right after, which is why the UI says so.
export async function restoreSnapshot(dbName: string, snapshotName: string): Promise<void> {
  const dir = await snapshotDir();
  const source = joinPath(dir, snapshotName);
  if (!(await pathExists(source)))
    throw new Error(`Snapshot ${snapshotName} is not there any more.`);

  for (const suffix of ['', '-wal', '-shm']) {
    await removePath(joinPath(SQLITE_DIR, `${dbName}${suffix}`));
  }
  await copyPath(source, joinPath(SQLITE_DIR, dbName));
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = joinPath(dir, `${snapshotName}${suffix}`);
    if (await pathExists(sidecar))
      await copyPath(sidecar, joinPath(SQLITE_DIR, `${dbName}${suffix}`));
  }
}

// Empties the snapshot folder. Only ever the user's own doing (Settings →
// Data → Delete all backups) — starting a dataset over means the copies of
// the old one are noise, and keeping them would leave the app restoring from
// a database that predates the fresh start.
export async function deleteAllSnapshots(): Promise<number> {
  const entries = await listFiles(await snapshotDir());
  let removed = 0;
  for (const entry of entries) {
    await removePath(entry.path);
    if (entry.name.endsWith('.db')) removed += 1;
  }
  return removed;
}
