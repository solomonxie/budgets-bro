import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { migrate } from './migrate';

const DB_NAME = 'budgetsbro.db';
// Pre-rebrand filename — migrateLegacyDbFile carries an existing install's
// data over to DB_NAME once, below, so renaming this doesn't silently
// orphan anyone's board data behind a fresh empty database.
const LEGACY_DB_NAME = 'yama.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

// expo-sqlite stores its databases at Documents/SQLite/, alongside the
// WAL/SHM sidecar files the journal_mode=WAL pragma below creates. Runs
// before the database is opened, so there's no concurrent writer to race.
// Idempotent: a fresh install has neither file (no-op), an already-
// migrated install has DB_NAME already (returns immediately), and only a
// pre-rebrand install actually has something to carry over.
function migrateLegacyDbFile(): void {
  const sqliteDir = new Directory(Paths.document, 'SQLite');
  if (new File(sqliteDir, DB_NAME).exists) return;
  for (const suffix of ['', '-wal', '-shm']) {
    const legacyFile = new File(sqliteDir, `${LEGACY_DB_NAME}${suffix}`);
    if (legacyFile.exists) legacyFile.move(new File(sqliteDir, `${DB_NAME}${suffix}`));
  }
}

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    migrateLegacyDbFile();
    dbPromise = openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync('PRAGMA foreign_keys = ON');
      // WAL + NORMAL sync is the standard mobile SQLite config (same trade
      // Core Data/Room make): fsync only the small WAL file, not the whole
      // db, on every commit — you can lose at most the single most-recent
      // commit on a hard crash, never corrupt existing data. Without this,
      // every repo call's own BEGIN/COMMIT (createTransaction, createTransfer,
      // etc.) fully fsyncs, and a bulk writer doing hundreds of sequential
      // small transactions — e.g. the demo-board seed — is visibly slow.
      await db.execAsync('PRAGMA journal_mode = WAL');
      await db.execAsync('PRAGMA synchronous = NORMAL');
      // Without this, a writer that can't get the lock immediately (e.g. a
      // connection left over from a Fast Refresh reload during dev) fails
      // with zero retry — or, worse, an app-level bug that leaves a
      // transaction open makes every later write wait forever with no
      // timeout at all. Bounding it turns that into a clear error instead
      // of the app looking frozen.
      await db.execAsync('PRAGMA busy_timeout = 5000');
      await migrate(db, DB_NAME);
      return db;
    });
  }
  return dbPromise;
}
