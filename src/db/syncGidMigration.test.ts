/**
 * @jest-environment node
 */
import { openDatabase } from './driver';
import type { SQLiteDatabase } from './driver';
import { migrate } from './migrate';
import { up as up046, SYNCED_TABLES } from '../../databases/migrations/046_sync_gid';
import { budgetEntryGid } from '../../sync-core/entities';

jest.mock('@op-engineering/op-sqlite', () => {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  return {
    IOS_DOCUMENT_PATH: '/documents',
    open: () => {
      const sqlite = new DatabaseSync(':memory:');
      return {
        execute: async (sql: string, params: unknown[] = []) => {
          const stmt = sqlite.prepare(sql);
          if (stmt.columns().length > 0) return { rows: stmt.all(...(params as never[])) };
          const r = stmt.run(...(params as never[]));
          return { rows: [], rowsAffected: Number(r.changes), insertId: Number(r.lastInsertRowid) };
        },
      };
    },
  };
});
jest.mock('./preMigrationSnapshot', () => ({ takeSnapshot: async () => {} }));

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let db: SQLiteDatabase;

const count = async (sql: string) => (await db.getFirstAsync<{ n: number }>(sql))!.n;

// Rows written before 046 have no gid; re-running it backfills them, the
// same path an existing install takes.
async function seed(transactions: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      INSERT INTO accounts (id, name, type, board_id) VALUES (1, 'Chequing', 'cash', 1);
      INSERT INTO category_groups (id, name, board_id) VALUES (1, 'Bills', 1);
      INSERT INTO categories (id, group_id, name, board_id) VALUES (1, 1, 'Rent', 1), (2, 1, 'Power', 1);
      INSERT INTO budget_entries (category_id, month, assigned_cents, board_id)
        VALUES (1, '2026-10', 100000, 1), (1, '2026-11', 100000, 1), (2, '2026-11', 8000, 1);
      INSERT INTO payees (id, name, board_id) VALUES (1, 'Landlord', 1);
    `);
    for (let i = 0; i < transactions; i++) {
      await db.runAsync(
        'INSERT INTO transactions (account_id, category_id, payee_id, amount_cents, date, board_id) VALUES (1, 1, 1, ?, ?, 1)',
        -100 - i,
        '2026-11-01',
      );
    }
    for (const table of SYNCED_TABLES) await db.execAsync(`UPDATE ${table} SET gid = NULL`);
  });
}

beforeEach(async () => {
  db = openDatabase('gid.db', '/documents/SQLite');
  await migrate(db);
});

describe('046 sync gid', () => {
  it('gives every row of every synced table a unique v4 gid', async () => {
    await seed(50);
    await up046(db);
    for (const table of SYNCED_TABLES) {
      const rows = await db.getAllAsync<{ gid: string | null }>(`SELECT gid FROM ${table}`);
      for (const r of rows) {
        if (table === 'budget_entries') continue;
        expect(r.gid).toMatch(UUID_V4);
      }
      expect(new Set(rows.map((r) => r.gid)).size).toBe(rows.length);
    }
  });

  it('derives budget entry gids from the category gid and month', async () => {
    await seed(0);
    await up046(db);
    const rows = await db.getAllAsync<{ gid: string; cat: string; month: string }>(
      'SELECT be.gid, c.gid AS cat, be.month FROM budget_entries be JOIN categories c ON c.id = be.category_id',
    );
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.gid).toBe(budgetEntryGid(r.cat, r.month));
  });

  it('logs nothing while backfilling, and logs gid on later writes', async () => {
    await seed(10);
    const before = await count('SELECT COUNT(*) n FROM change_log');
    await up046(db);
    expect(await count('SELECT COUNT(*) n FROM change_log')).toBe(before);

    await db.runAsync("UPDATE payees SET name = 'Owner' WHERE id = 1");
    const entry = await db.getFirstAsync<{ after: string }>(
      "SELECT after FROM change_log WHERE tbl = 'payees' ORDER BY seq DESC LIMIT 1",
    );
    expect(JSON.parse(entry!.after).gid).toMatch(UUID_V4);
  });

  it('logs boards and homes tables', async () => {
    await db.execAsync("INSERT INTO houses (board_id, name) VALUES (1, 'Maple St')");
    await db.execAsync("UPDATE boards SET name = 'Home' WHERE id = 1");
    expect(await count("SELECT COUNT(*) n FROM change_log WHERE tbl IN ('houses', 'boards')")).toBe(2);
  });

  it('rejects a duplicate gid', async () => {
    const gid = (await db.getFirstAsync<{ gid: string }>('SELECT gid FROM boards WHERE id = 1'))!.gid;
    await expect(db.runAsync("INSERT INTO boards (name, gid) VALUES ('Copy', ?)", gid)).rejects.toThrow();
  });

  it('backfills a 50k-transaction ledger quickly', async () => {
    await seed(50000);
    const t0 = Date.now();
    await up046(db);
    const ms = Date.now() - t0;
    expect(await count('SELECT COUNT(*) n FROM transactions WHERE gid IS NULL')).toBe(0);
    expect(ms).toBeLessThan(5000);
  }, 60000);
});
