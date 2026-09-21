import type { SQLiteDatabase } from '../db/driver';
import { takeSnapshot } from './preMigrationSnapshot';
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
import { up as up013 } from '../../databases/migrations/013_drop_transaction_is_interest';
import { up as up014 } from '../../databases/migrations/014_rename_account_value_history';
import { up as up015 } from '../../databases/migrations/015_scheduled_transactions';
import { up as up016 } from '../../databases/migrations/016_drop_checking_and_income_types';
import { up as up017 } from '../../databases/migrations/017_scheduled_transaction_days_of_week';
import { up as up018 } from '../../databases/migrations/018_custom_goals';
import { up as up019 } from '../../databases/migrations/019_income_detail_history';
import { up as up020 } from '../../databases/migrations/020_drop_scheduled_transaction_auto_post';
import { up as up021 } from '../../databases/migrations/021_income_account_tag';
import { up as up030 } from '../../databases/migrations/030_change_log';
import { up as up031 } from '../../databases/migrations/031_transaction_purchase_items';
import { up as up032 } from '../../databases/migrations/032_purchase_items_index';
import { up as up029 } from '../../databases/migrations/029_clear_inapplicable_categories';
import { up as up028 } from '../../databases/migrations/028_drop_income_accounts';
import { up as up027 } from '../../databases/migrations/027_transfer_payee_other_side';
import { up as up026 } from '../../databases/migrations/026_backfill_transfer_payees';
import { up as up025 } from '../../databases/migrations/025_rate_history_note';
import { up as up024 } from '../../databases/migrations/024_value_history_kind';
import { up as up023 } from '../../databases/migrations/023_notes';
import { up as up022 } from '../../databases/migrations/022_ai_request_history';

type Migration = {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
  // Set on a migration that changes or clears rows that already exist, as
  // opposed to only adding columns/tables. Triggers a snapshot of the whole
  // database before the batch runs, because there is otherwise nothing to
  // go back to when the rewrite turns out to be wrong.
  rewritesData?: boolean;
};

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
  { version: 13, up: up013 },
  { version: 14, up: up014 },
  { version: 15, up: up015 },
  { version: 16, up: up016 },
  { version: 17, up: up017 },
  { version: 18, up: up018 },
  { version: 19, up: up019 },
  { version: 20, up: up020 },
  { version: 21, up: up021 },
  { version: 22, up: up022 },
  { version: 23, up: up023 },
  { version: 24, up: up024 },
  { version: 25, up: up025 },
  { version: 26, up: up026, rewritesData: true },
  { version: 27, up: up027, rewritesData: true },
  { version: 28, up: up028, rewritesData: true },
  { version: 29, up: up029, rewritesData: true },
  { version: 30, up: up030 },
  { version: 31, up: up031 },
  { version: 32, up: up032 },
];

// Small versioned migration runner: expo-sqlite has no built-in migration
// framework, so schema version is tracked via PRAGMA user_version.
// Migrations that only add a column or a table can't lose anything. One that
// rewrites or clears existing rows can, and the old values are gone the
// moment it commits — migration 029 cleared categories that turned out to be
// load-bearing for Unassigned Cash, and there was nothing to go back to.
// Those are marked `rewritesData`, and the database is copied aside before
// the batch runs (see preMigrationSnapshot).
function rewritesExistingData(from: number, to: number): boolean {
  return migrations.some((m) => m.version > from && m.version <= to && m.rewritesData);
}

export async function migrate(db: SQLiteDatabase, dbName = 'budgetsbro.db'): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = row?.user_version ?? 0;
  const target = migrations[migrations.length - 1]?.version ?? currentVersion;

  if (target > currentVersion && rewritesExistingData(currentVersion, target)) {
    // WAL checkpoint first, so the copy has every committed write in the
    // main file rather than only in the sidecar.
    await db.execAsync('PRAGMA wal_checkpoint(FULL)');
    try {
      await takeSnapshot(dbName, currentVersion, target);
    } catch (e) {
      // A snapshot that fails must not stop the app opening — it is
      // insurance, not a precondition.
      console.warn('[migrate] pre-migration snapshot failed', e);
    }
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    await migration.up(db);
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
}
