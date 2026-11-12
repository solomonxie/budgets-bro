/**
 * @jest-environment node
 */
import { openDatabase } from './driver';
import type { SQLiteDatabase } from './driver';
import { migrate } from './migrate';
import * as budgetsRepo from './repositories/budgetsRepo';
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

let db: SQLiteDatabase;

const assigned = async (categoryId: number) =>
  (
    await db.getFirstAsync<{ c: number }>(
      "SELECT assigned_cents AS c FROM budget_entries WHERE category_id = ? AND month = '2026-11'",
      categoryId,
    )
  )?.c ?? null;

beforeEach(async () => {
  db = openDatabase('move.db', '/documents/SQLite');
  await migrate(db);
  await db.execAsync(`
    INSERT INTO category_groups (id, name, board_id, gid) VALUES (1, 'Bills', 1, 'g-group');
    INSERT INTO categories (id, group_id, name, board_id, gid) VALUES
      (1, 1, 'Groceries', 1, 'g-groceries'), (2, 1, 'Dining', 1, 'g-dining');
  `);
  await budgetsRepo.setAssignedCents(db, 1, 1, '2026-11', 40000);
});

it('moves this month’s assignment from one category to another', async () => {
  await budgetsRepo.moveAssignedCents(db, 1, 1, 2, '2026-11', 7500);
  expect(await assigned(1)).toBe(32500);
  expect(await assigned(2)).toBe(7500);
});

it('creates the receiving entry with its derived gid', async () => {
  await budgetsRepo.moveAssignedCents(db, 1, 1, 2, '2026-11', 100);
  const row = await db.getFirstAsync<{ gid: string }>(
    "SELECT gid FROM budget_entries WHERE category_id = 2 AND month = '2026-11'",
  );
  expect(row?.gid).toBe(budgetEntryGid('g-dining', '2026-11'));
});

it('logs both sides in one transaction', async () => {
  await budgetsRepo.moveAssignedCents(db, 1, 1, 2, '2026-11', 100);
  const rows = await db.getAllAsync<{ txn: number }>(
    "SELECT txn FROM change_log WHERE tbl = 'budget_entries' ORDER BY seq DESC LIMIT 2",
  );
  expect(rows).toHaveLength(2);
  expect(rows[0].txn).toBe(rows[1].txn);
});
