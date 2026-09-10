import type { SQLiteDatabase } from 'expo-sqlite';
import { up as up001 } from '../../databases/migrations/001_init';
import { up as up002 } from '../../databases/migrations/002_linked_category';
import { up as up003 } from '../../databases/migrations/003_loan_terms_and_settings';
import { up as up004 } from '../../databases/migrations/004_category_group_archive';

type Migration = { version: number; up: (db: SQLiteDatabase) => Promise<void> };

const migrations: Migration[] = [
  { version: 1, up: up001 },
  { version: 2, up: up002 },
  { version: 3, up: up003 },
  { version: 4, up: up004 },
];

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
