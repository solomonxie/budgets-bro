import type { SQLiteDatabase } from 'expo-sqlite';
import { up as up001 } from './migrations/001_init';

type Migration = { version: number; up: (db: SQLiteDatabase) => Promise<void> };

const migrations: Migration[] = [{ version: 1, up: up001 }];

// Small versioned migration runner: expo-sqlite has no built-in migration
// framework, so schema version is tracked via PRAGMA user_version.
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    await migration.up(db);
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
}
