/**
 * @jest-environment node
 */
import { openDatabase } from './driver';
import type { SQLiteDatabase } from './driver';
import { migrate } from './migrate';
import { newGid } from './gid';
import { SYNCED_TABLES } from '../../databases/migrations/046_sync_gid';
import { budgetEntryGid } from '../../sync-core/entities';
import { seedDemoBoard } from './seed/demoBoard';
import * as boardsRepo from './repositories/boardsRepo';
import * as accountsRepo from './repositories/accountsRepo';
import * as transactionsRepo from './repositories/transactionsRepo';
import * as budgetsRepo from './repositories/budgetsRepo';
import * as changeLogRepo from './repositories/changeLogRepo';
import * as housesRepo from './repositories/housesRepo';
import { currentMonth } from '../domain/month';

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

beforeEach(async () => {
  db = openDatabase('gid.db', '/documents/SQLite');
  await migrate(db);
});

async function cash(boardId: number, name: string): Promise<number> {
  return accountsRepo.createAccount(db, boardId, { name, type: 'cash', openingBalanceCents: 0 } as never);
}

describe('newGid', () => {
  it('is a lowercase UUID v4', () => {
    const gids = Array.from({ length: 200 }, newGid);
    for (const g of gids) expect(g).toMatch(UUID_V4);
    expect(new Set(gids).size).toBe(gids.length);
  });
});

describe('every insert path sets gid', () => {
  it('leaves no synced row without one', async () => {
    await seedDemoBoard(db);
    const boardId = await boardsRepo.createBoard(db, 'Second');
    const a = await cash(boardId, 'Chequing');
    const b = await cash(boardId, 'Savings');
    await transactionsRepo.createTransfer(db, boardId, { fromAccountId: a, toAccountId: b, amountCents: 500, date: '2026-01-02', memo: null });
    await transactionsRepo.correctBalance(db, boardId, a, 123);
    await transactionsRepo.importTransaction(db, boardId, {
      accountId: a, categoryId: null, payeeId: null, memo: null, amountCents: -9, date: '2026-01-03', transferAccountId: null, importId: 'ynab:1',
    });
    await budgetsRepo.closePastBudgetMonths(db, boardId);
    const house = (await db.getFirstAsync<{ id: number }>('SELECT id FROM houses'))!.id;
    await housesRepo.logHousePrice(db, house, '2026-01-04', 99900000);

    for (const table of SYNCED_TABLES) {
      const rows = await db.getAllAsync<{ gid: string | null }>(`SELECT gid FROM ${table}`);
      expect({ table, rows: rows.length > 0 }).toEqual({ table, rows: true });
      expect({ table, missing: rows.filter((r) => r.gid == null).length }).toEqual({ table, missing: 0 });
    }
  });

  it('derives the budget entry gid from its category', async () => {
    const boardId = await boardsRepo.createBoard(db, 'B');
    await db.runAsync("INSERT INTO category_groups (board_id, name, gid) VALUES (?, 'G', ?)", boardId, newGid());
    const cat = await db.getFirstAsync<{ id: number }>('SELECT id FROM category_groups WHERE board_id = ?', boardId);
    await db.runAsync("INSERT INTO categories (board_id, group_id, name, gid) VALUES (?, ?, 'Rent', 'cat-gid')", boardId, cat!.id);
    const categoryId = (await db.getFirstAsync<{ id: number }>("SELECT id FROM categories WHERE gid = 'cat-gid'"))!.id;
    const month = currentMonth();
    await budgetsRepo.setAssignedCents(db, boardId, categoryId, month, 100);
    await budgetsRepo.setAssignedCents(db, boardId, categoryId, month, 200);
    const row = await db.getFirstAsync<{ gid: string; assigned_cents: number }>('SELECT gid, assigned_cents FROM budget_entries WHERE category_id = ?', categoryId);
    expect(row).toEqual({ gid: budgetEntryGid('cat-gid', month), assigned_cents: 200 });
  });

  it('keeps a deleted row’s gid when undone, and mints one for a pre-046 entry', async () => {
    const boardId = await boardsRepo.createBoard(db, 'U');
    const a = await cash(boardId, 'Chequing');
    const id = await transactionsRepo.createTransaction(db, boardId, {
      accountId: a, categoryId: null, payeeName: '', memo: null, amountCents: -5, date: '2026-01-01',
    });
    const before = (await db.getFirstAsync<{ gid: string }>('SELECT gid FROM transactions WHERE id = ?', id))!.gid;
    await transactionsRepo.deleteTransactions(db, boardId, [id]);
    const [deleted] = (await changeLogRepo.listChangeGroups(db)).groups;
    await changeLogRepo.undoGroup(db, deleted);
    expect((await db.getFirstAsync<{ gid: string }>('SELECT gid FROM transactions WHERE id = ?', id))!.gid).toBe(before);

    // An entry logged before 046 has no gid key at all.
    await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
    await db.runAsync(
      "UPDATE change_log SET before = json_remove(before, '$.gid') WHERE seq = (SELECT MAX(seq) FROM change_log)",
    );
    const [old] = (await changeLogRepo.listChangeGroups(db)).groups;
    await changeLogRepo.undoGroup(db, old);
    const restored = await db.getFirstAsync<{ gid: string | null }>('SELECT gid FROM transactions WHERE id = ?', id);
    expect(restored?.gid).toMatch(UUID_V4);
  });
});
