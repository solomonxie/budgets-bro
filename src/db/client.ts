import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrate } from './migrate';

const DB_NAME = 'yama.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync('PRAGMA foreign_keys = ON');
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
