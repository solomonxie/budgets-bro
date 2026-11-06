import type { SQLiteDatabase } from '../../src/db/driver';
import { budgetEntryGid } from '../../sync-core/entities';
import { rebuildChangeLogTriggers } from './030_change_log';

// Every synced table — docs/design/browser-sync/PROTOCOL.md.
export const SYNCED_TABLES = [
  'boards',
  'accounts',
  'category_groups',
  'categories',
  'budget_entries',
  'payees',
  'transactions',
  'scheduled_transactions',
  'custom_goals',
  'payment_decisions',
  'account_value_history',
  'account_rate_history',
  'houses',
  'community_prices',
  'house_prices',
] as const;

// A lowercase UUID v4, per row: randomblob is evaluated once per row.
export const SQL_UUID_V4 = `lower(
  hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
  hex(randomblob(6))
)`;

const BATCH = 400;

// A row's identity across devices. Local integer ids stay; sync translates
// at the boundary. The column can't be NOT NULL (ALTER needs a default), so
// every insert path must set it (repos, import, restore).
export async function up(db: SQLiteDatabase): Promise<void> {
  // The backfill below would otherwise log every row of the ledger as an update.
  for (const table of SYNCED_TABLES) {
    await db.execAsync(`DROP TRIGGER IF EXISTS trg_${table}_log_update;`);
  }

  await db.withTransactionAsync(async () => {
    for (const table of SYNCED_TABLES) {
      const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      if (cols.length === 0) continue;
      if (!cols.some((c) => c.name === 'gid')) {
        await db.execAsync(`ALTER TABLE ${table} ADD COLUMN gid TEXT;`);
      }
      if (table !== 'budget_entries') {
        await db.execAsync(`UPDATE ${table} SET gid = ${SQL_UUID_V4} WHERE gid IS NULL;`);
      }
    }
    await backfillBudgetEntries(db);
    for (const table of SYNCED_TABLES) {
      await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_gid ON ${table}(gid);`);
    }
  });

  await rebuildChangeLogTriggers(db);
}

async function backfillBudgetEntries(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ id: number; categoryGid: string; month: string }>(
    `SELECT be.id, c.gid AS categoryGid, be.month FROM budget_entries be
     JOIN categories c ON c.id = be.category_id WHERE be.gid IS NULL`,
  );
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const params: (string | number)[] = [];
    for (const r of batch) params.push(r.id, budgetEntryGid(r.categoryGid, r.month));
    for (const r of batch) params.push(r.id);
    await db.runAsync(
      `UPDATE budget_entries SET gid = CASE id ${batch.map(() => 'WHEN ? THEN ?').join(' ')} END
       WHERE id IN (${batch.map(() => '?').join(', ')})`,
      ...params,
    );
  }
  // An entry whose category is gone has no cell to derive from.
  await db.execAsync(`UPDATE budget_entries SET gid = ${SQL_UUID_V4} WHERE gid IS NULL;`);
}
