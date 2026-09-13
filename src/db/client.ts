import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrate } from './migrate';

const DB_NAME = 'yama.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
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
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
