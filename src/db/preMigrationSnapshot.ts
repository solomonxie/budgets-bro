import { Directory, File, Paths } from 'expo-file-system';

const SQLITE_DIR = 'SQLite';
const SNAPSHOT_DIR = 'db-snapshots';
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

function snapshotDir(): Directory {
  const dir = new Directory(Paths.document, SNAPSHOT_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
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

export function listSnapshots(): DbSnapshot[] {
  const dir = snapshotDir();
  return dir
    .list()
    .flatMap((entry) => {
      const snapshot = entry instanceof File ? parse(entry.name) : null;
      return snapshot ? [{ ...snapshot, sizeBytes: entry instanceof File ? (entry.size ?? 0) : 0 }] : [];
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
export function takeSnapshot(dbName: string, fromVersion: number, toVersion: number): DbSnapshot | null {
  const sqliteDir = new Directory(Paths.document, SQLITE_DIR);
  const source = new File(sqliteDir, dbName);
  if (!source.exists) return null;

  const takenAt = new Date().toISOString().replace(/:/g, '_');
  const base = `v${fromVersion}-to-v${toVersion}-${takenAt}`;
  const dir = snapshotDir();
  source.copy(new File(dir, `${base}.db`));
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = new File(sqliteDir, `${dbName}${suffix}`);
    if (sidecar.exists) sidecar.copy(new File(dir, `${base}.db${suffix}`));
  }

  prune();
  return parse(`${base}.db`);
}

function prune(): void {
  const dir = snapshotDir();
  const snapshots = listSnapshots();
  for (const stale of snapshots.slice(KEEP)) {
    for (const suffix of ['', '-wal', '-shm']) {
      const file = new File(dir, `${stale.name}${suffix}`);
      if (file.exists) file.delete();
    }
  }
}

// Puts a snapshot back as the live database. The caller is responsible for
// making sure nothing holds an open connection — in practice this means
// restarting the app right after, which is why the UI says so.
export function restoreSnapshot(dbName: string, snapshotName: string): void {
  const dir = snapshotDir();
  const sqliteDir = new Directory(Paths.document, SQLITE_DIR);
  const source = new File(dir, snapshotName);
  if (!source.exists) throw new Error(`Snapshot ${snapshotName} is not there any more.`);

  for (const suffix of ['', '-wal', '-shm']) {
    const live = new File(sqliteDir, `${dbName}${suffix}`);
    if (live.exists) live.delete();
  }
  source.copy(new File(sqliteDir, dbName));
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = new File(dir, `${snapshotName}${suffix}`);
    if (sidecar.exists) sidecar.copy(new File(sqliteDir, `${dbName}${suffix}`));
  }
}

// Empties the snapshot folder. Only ever the user's own doing (Settings →
// Data → Delete all backups) — starting a dataset over means the copies of
// the old one are noise, and keeping them would leave the app restoring from
// a database that predates the fresh start.
export function deleteAllSnapshots(): number {
  const dir = snapshotDir();
  let removed = 0;
  for (const entry of dir.list()) {
    if (entry instanceof File) {
      entry.delete();
      if (entry.name.endsWith('.db')) removed += 1;
    }
  }
  return removed;
}
