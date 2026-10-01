import { IOS_DOCUMENT_PATH } from '@op-engineering/op-sqlite';
import { joinPath, movePath, pathExists } from '../files/fileStore';
import { openDatabase, type SQLiteDatabase } from './driver';
import { migrate } from './migrate';

const DB_NAME = 'budgetsbro.db';
// Pre-rebrand filename — migrateLegacyDbFile carries an existing install's
// data over to DB_NAME once, below, so renaming this doesn't silently
// orphan anyone's board data behind a fresh empty database.
const LEGACY_DB_NAME = 'yama.db';

// Kept where expo-sqlite used to put it, Documents/SQLite, so an install
// that predates the engine swap opens the database it already has rather
// than a fresh empty one beside it.
const DB_DIRECTORY = `${IOS_DOCUMENT_PATH}/SQLite`;

let dbPromise: Promise<SQLiteDatabase> | null = null;

// Databases live at Documents/SQLite/, alongside the WAL/SHM sidecar files
// the journal_mode=WAL pragma below creates. Runs
// before the database is opened, so there's no concurrent writer to race.
// Idempotent: a fresh install has neither file (no-op), an already-
// migrated install has DB_NAME already (returns immediately), and only a
// pre-rebrand install actually has something to carry over.
async function migrateLegacyDbFile(): Promise<void> {
  if (await pathExists(joinPath(DB_DIRECTORY, DB_NAME))) return;
  for (const suffix of ['', '-wal', '-shm']) {
    const legacy = joinPath(DB_DIRECTORY, `${LEGACY_DB_NAME}${suffix}`);
    if (await pathExists(legacy))
      await movePath(legacy, joinPath(DB_DIRECTORY, `${DB_NAME}${suffix}`));
  }
}

const DEMO_DB_NAME = 'budgetsbro-demo.db';
const DEMO_MODE_KEY = 'demo_mode';

let realDbPromise: Promise<SQLiteDatabase> | null = null;
let demoDbPromise: Promise<SQLiteDatabase> | null = null;
let demoMode = false;

async function open(name: string): Promise<SQLiteDatabase> {
  const db = openDatabase(name, DB_DIRECTORY);
  await db.execAsync('PRAGMA foreign_keys = ON');
  // WAL + NORMAL sync is the standard mobile SQLite config (same trade
  // Core Data/Room make): fsync only the small WAL file, not the whole
  // db, on every commit — you can lose at most the single most-recent
  // commit on a hard crash, never corrupt existing data. Without this,
  // every repo call's own BEGIN/COMMIT (createTransaction, createTransfer,
  // etc.) fully fsyncs, and a bulk writer doing hundreds of sequential
  // small transactions — e.g. the demo seed — is visibly slow.
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA synchronous = NORMAL');
  // Without this, a writer that can't get the lock immediately (e.g. a
  // connection left over from a Fast Refresh reload during dev) fails
  // with zero retry — or, worse, an app-level bug that leaves a
  // transaction open makes every later write wait forever with no
  // timeout at all. Bounding it turns that into a clear error instead
  // of the app looking frozen.
  await db.execAsync('PRAGMA busy_timeout = 5000');
  await migrate(db, name);
  return db;
}

function getRealDb(): Promise<SQLiteDatabase> {
  realDbPromise ??= (async () => {
    await migrateLegacyDbFile();
    const db = await open(DB_NAME);
    demoMode = (await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', DEMO_MODE_KEY))?.value === '1';
    return db;
  })();
  return realDbPromise;
}

// Demo mode swaps in a separate database file; the real one is only read
// for the switch itself, so nothing done in demo can touch real data.
export function getDb(): Promise<SQLiteDatabase> {
  dbPromise ??= getRealDb().then((real) => (demoMode ? (demoDbPromise ??= open(DEMO_DB_NAME)) : real));
  return dbPromise;
}

export async function isDemoMode(): Promise<boolean> {
  await getRealDb();
  return demoMode;
}

export async function setDemoMode(on: boolean): Promise<void> {
  const real = await getRealDb();
  await real.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', DEMO_MODE_KEY, on ? '1' : '0');
  demoMode = on;
  dbPromise = null;
}
