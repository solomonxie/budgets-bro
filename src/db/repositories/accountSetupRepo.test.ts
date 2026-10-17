/**
 * @jest-environment node
 */
import { openDatabase } from '../driver';
import type { SQLiteDatabase } from '../driver';
import { migrate } from '../migrate';
import * as accountValueHistoryRepo from './accountValueHistoryRepo';
import * as boardsRepo from './boardsRepo';
import { createSetupAccounts } from './accountSetupRepo';

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
jest.mock('../preMigrationSnapshot', () => ({ takeSnapshot: async () => {} }));

let db: SQLiteDatabase;

beforeAll(async () => {
  db = openDatabase('setup.db', '/documents/SQLite');
  await migrate(db);
}, 60000);

const accountId = async (boardId: number, name: string) =>
  (await db.getFirstAsync<{ id: number }>('SELECT id FROM accounts WHERE board_id = ? AND name = ?', boardId, name))!.id;

const ledgerSum = async (id: number) =>
  (await db.getFirstAsync<{ s: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS s FROM transactions WHERE account_id = ?', id))!.s;

const readings = (id: number) =>
  db.getAllAsync<{ kind: string; value_cents: number }>(
    'SELECT kind, value_cents FROM account_value_history WHERE account_id = ? ORDER BY kind',
    id,
  );

describe('createSetupAccounts', () => {
  it('writes each amount where its account type keeps it', async () => {
    const boardId = await boardsRepo.createBoard(db, 'Setup');
    await createSetupAccounts(db, boardId, [
      { name: 'Checking', type: 'cash', trackingKind: null, amountCents: -2_500, homeWorthCents: null },
      { name: 'Visa', type: 'credit_card', trackingKind: null, amountCents: 40_000, homeWorthCents: null },
      { name: 'Mortgage', type: 'mortgage', trackingKind: null, amountCents: 30_000_000, homeWorthCents: 45_000_000 },
      { name: 'TFSA', type: 'tracking', trackingKind: 'ca_tfsa', amountCents: 1_000_000, homeWorthCents: null },
      { name: 'Car', type: 'asset', trackingKind: null, amountCents: null, homeWorthCents: null },
    ]);

    expect(await ledgerSum(await accountId(boardId, 'Checking'))).toBe(-2_500);
    expect(await ledgerSum(await accountId(boardId, 'Visa'))).toBe(-40_000);
    expect(await readings(await accountId(boardId, 'Mortgage'))).toEqual([
      { kind: 'principal', value_cents: 30_000_000 },
      { kind: 'value', value_cents: 45_000_000 },
    ]);
    expect(await readings(await accountId(boardId, 'TFSA'))).toEqual([{ kind: 'value', value_cents: 1_000_000 }]);
    expect(await readings(await accountId(boardId, 'Car'))).toEqual([]);
  });

  it('adds nothing when any account fails', async () => {
    const boardId = await boardsRepo.createBoard(db, 'Rollback');
    const spy = jest.spyOn(accountValueHistoryRepo, 'addValueChange').mockRejectedValueOnce(new Error('disk full'));
    await expect(
      createSetupAccounts(db, boardId, [
        { name: 'Checking', type: 'cash', trackingKind: null, amountCents: 100, homeWorthCents: null },
        { name: 'TFSA', type: 'tracking', trackingKind: 'ca_tfsa', amountCents: 500, homeWorthCents: null },
      ]),
    ).rejects.toThrow('disk full');
    spy.mockRestore();
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM accounts WHERE board_id = ?', boardId);
    expect(count!.n).toBe(0);
  });
});
