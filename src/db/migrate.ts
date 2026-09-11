import type { SQLiteDatabase } from 'expo-sqlite';
import { up as up001 } from '../../databases/migrations/001_init';
import { up as up002 } from '../../databases/migrations/002_linked_category';
import { up as up003 } from '../../databases/migrations/003_loan_terms_and_settings';
import { up as up004 } from '../../databases/migrations/004_category_group_archive';
import { up as up005 } from '../../databases/migrations/005_unlink_ready_to_assign';
import { up as up006 } from '../../databases/migrations/006_boards';
import { up as up007 } from '../../databases/migrations/007_loan_rate_history';
import { up as up008 } from '../../databases/migrations/008_payee_account_link';
import { up as up009 } from '../../databases/migrations/009_payee_per_account';
import { up as up010 } from '../../databases/migrations/010_transaction_import_id_per_board';
import { up as up011 } from '../../databases/migrations/011_house_value_history';
import { up as up012 } from '../../databases/migrations/012_drop_transaction_cleared';

type Migration = { version: number; up: (db: SQLiteDatabase) => Promise<void> };

const migrations: Migration[] = [
  { version: 1, up: up001 },
  { version: 2, up: up002 },
  { version: 3, up: up003 },
  { version: 4, up: up004 },
  { version: 5, up: up005 },
  { version: 6, up: up006 },
  { version: 7, up: up007 },
  { version: 8, up: up008 },
  { version: 9, up: up009 },
  { version: 10, up: up010 },
  { version: 11, up: up011 },
  { version: 12, up: up012 },
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
