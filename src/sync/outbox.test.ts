/**
 * @jest-environment node
 */
import { openDatabase } from '../db/driver';
import type { SQLiteDatabase } from '../db/driver';
import { migrate } from '../db/migrate';
import * as boardsRepo from '../db/repositories/boardsRepo';
import * as accountsRepo from '../db/repositories/accountsRepo';
import * as transactionsRepo from '../db/repositories/transactionsRepo';
import * as changeLogRepo from '../db/repositories/changeLogRepo';
import * as syncStateRepo from '../db/repositories/syncStateRepo';
import { syncedColumns } from '../../sync-core/columns';
import { SYNCED_TABLES } from '../../databases/migrations/046_sync_gid';
import type { Group, WireOp } from '../../sync-core/types';
import { buildOutbox } from './outbox';

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
jest.mock('../db/preMigrationSnapshot', () => ({ takeSnapshot: async () => {} }));
const mockDemo = jest.fn(async () => false);
jest.mock('../db/client', () => ({ isDemoMode: () => mockDemo() }));

const NOW = 1793414025000;
const now = () => NOW;

let db: SQLiteDatabase;
let boardId: number;

beforeEach(async () => {
  mockDemo.mockResolvedValue(false);
  db = openDatabase('outbox.db', '/documents/SQLite');
  await migrate(db);
  boardId = await boardsRepo.createBoard(db, 'Home');
  await skipToNow();
});

// Start each test with everything so far already sent.
async function skipToNow() {
  const batch = await buildOutbox(db, now);
  if (batch) await syncStateRepo.setMeta(db, 'outboxCursor', batch.cursor);
}

async function send(): Promise<Group[]> {
  const batch = await buildOutbox(db, now);
  if (!batch) return [];
  await syncStateRepo.setMeta(db, 'outboxCursor', batch.cursor);
  await syncStateRepo.setMeta(db, 'hlc', batch.hlc);
  return batch.groups;
}

const gidOf = async (table: string, id: number) =>
  (await db.getFirstAsync<{ gid: string }>(`SELECT gid FROM ${table} WHERE id = ?`, id))!.gid;

const cash = (name: string) =>
  accountsRepo.createAccount(db, boardId, { name, type: 'cash', openingBalanceCents: 0 } as never);

const spend = (accountId: number, amountCents: number) =>
  transactionsRepo.createTransaction(db, boardId, {
    accountId, categoryId: null, payeeName: '', memo: null, amountCents, date: '2026-01-02',
  });

const opsFor = (groups: Group[], e: string): WireOp[] => groups.flat().filter((op) => op.e === e);

describe('buildOutbox', () => {
  it('sends an insert as an add carrying every synced field and FKs as gids', async () => {
    const account = await cash('Chequing');
    const [group] = await send();
    const add = group.find((op) => op.e === 'accounts')!;
    expect(add.o).toBe('add');
    expect(add.id).toBe(await gidOf('accounts', account));
    const x = add.x as Record<string, unknown>;
    expect(Object.keys(x).sort()).toEqual([...syncedColumns.accounts, 'deleted'].sort());
    expect(x.board_id).toBe(await gidOf('boards', boardId));
    expect(x.deleted).toBeNull();
    expect(x.name).toBe('Chequing');
  });

  it('sends an update as one set per changed field', async () => {
    const account = await cash('Chequing');
    const tx = await spend(account, -500);
    await send();
    await db.runAsync("UPDATE transactions SET memo = 'Lunch', amount_cents = -700 WHERE id = ?", tx);
    const ops = opsFor(await send(), 'transactions');
    expect(ops.map((op) => [op.o, op.f, op.x]).sort()).toEqual([
      ['set', 'amount_cents', -700],
      ['set', 'memo', 'Lunch'],
    ]);
  });

  it('sends a delete as set deleted, and an undo as an add with deleted null', async () => {
    const account = await cash('Chequing');
    const tx = await spend(account, -500);
    const gid = await gidOf('transactions', tx);
    await send();

    await transactionsRepo.deleteTransactions(db, boardId, [tx]);
    const [deleted] = opsFor(await send(), 'transactions');
    expect(deleted).toMatchObject({ o: 'set', id: gid, f: 'deleted' });
    expect(deleted.x).toBe(Number(deleted.h.split('-')[0]));

    const [undo] = (await changeLogRepo.listChangeGroups(db)).groups;
    await changeLogRepo.undoGroup(db, undo);
    const [readded] = opsFor(await send(), 'transactions');
    expect(readded).toMatchObject({ o: 'add', id: gid });
    expect((readded.x as Record<string, unknown>).deleted).toBeNull();
  });

  it('puts both legs of a transfer in one group under one tick', async () => {
    const a = await cash('Chequing');
    const b = await cash('Savings');
    await send();
    await transactionsRepo.createTransfer(db, boardId, {
      fromAccountId: a, toAccountId: b, amountCents: 500, date: '2026-01-02', memo: null,
    });
    const groups = await send();
    const legs = groups.filter((g) => g.some((op) => op.e === 'transactions'));
    expect(legs).toHaveLength(1);
    const adds = legs[0].filter((op) => op.e === 'transactions' && op.o === 'add');
    expect(adds).toHaveLength(2);
    expect(new Set(legs[0].map((op) => op.h)).size).toBe(1);
    const accounts = adds.map((op) => (op.x as Record<string, unknown>).account_id).sort();
    expect(accounts).toEqual([await gidOf('accounts', a), await gidOf('accounts', b)].sort());
  });

  it('collapses writes to one field within a transaction into one op', async () => {
    const account = await cash('Chequing');
    const tx = await spend(account, -500);
    await send();
    await db.withTransactionAsync(async () => {
      await db.runAsync("UPDATE transactions SET memo = 'a' WHERE id = ?", tx);
      await db.runAsync("UPDATE transactions SET memo = 'b' WHERE id = ?", tx);
    });
    const ops = opsFor(await send(), 'transactions');
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ o: 'set', f: 'memo', x: 'b' });
  });

  it('ticks each transaction separately and keeps the clock moving', async () => {
    const account = await cash('Chequing');
    await send();
    await spend(account, -1);
    await spend(account, -2);
    const groups = await send();
    expect(groups).toHaveLength(2);
    const stamps = groups.map((g) => g[0].h);
    expect(new Set(stamps).size).toBe(stamps.length);
    expect([...stamps].sort()).toEqual(stamps);
    for (const g of groups) expect(new Set(g.map((op) => op.h)).size).toBe(1);
  });

  it('finds the gid of an FK target deleted in an earlier batch', async () => {
    const gone = await cash('Old card');
    const goneGid = await gidOf('accounts', gone);
    const tx = await spend(await cash('New card'), -500);
    await db.execAsync('PRAGMA foreign_keys = OFF');
    await db.runAsync('DELETE FROM accounts WHERE id = ?', gone);
    await send();
    await db.runAsync('UPDATE transactions SET account_id = ? WHERE id = ?', gone, tx);
    const [op] = opsFor(await send(), 'transactions');
    expect(op).toMatchObject({ o: 'set', f: 'account_id', x: goneGid });
  });

  it('skips rows the applier wrote', async () => {
    const account = await cash('Chequing');
    await send();
    const lo = (await changeLogRepo.latestChangeSeq(db)) + 1;
    await spend(account, -1);
    const hi = await changeLogRepo.latestChangeSeq(db);
    await syncStateRepo.addRemoteRange(db, { lo, hi });
    await spend(account, -2);
    const ops = opsFor(await send(), 'transactions').filter((op) => op.o === 'add');
    expect(ops.map((op) => (op.x as Record<string, unknown>).amount_cents)).toEqual([-2]);
    expect(await buildOutbox(db, now)).toBeNull();
  });

  it('sends nothing for demo data', async () => {
    await cash('Chequing');
    mockDemo.mockResolvedValue(true);
    expect(await buildOutbox(db, now)).toBeNull();
  });

  it('waits while a transaction is open rather than read half of it', async () => {
    const account = await cash('Chequing');
    await send();
    let seen: unknown = 'unset';
    await db.withTransactionAsync(async () => {
      await spend(account, -1);
      seen = await buildOutbox(db, now);
    });
    expect(seen).toBeNull();
    expect(opsFor(await send(), 'transactions')).toHaveLength(1);
  });

  it('advances the cursor past rows it has nothing to send for', async () => {
    const account = await cash('Chequing');
    const tx = await spend(account, -1);
    await send();
    // Only an unsynced column changes.
    await db.runAsync("UPDATE transactions SET updated_at = '2030-01-01' WHERE id = ?", tx);
    const batch = await buildOutbox(db, now);
    expect(batch!.groups).toEqual([]);
    expect(batch!.cursor).toBe(await changeLogRepo.latestChangeSeq(db));
  });
});

describe('syncedColumns', () => {
  it('covers every column of every synced table but id, gid and updated_at', async () => {
    for (const table of SYNCED_TABLES) {
      const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      const local = cols.map((c) => c.name).filter((c) => !['id', 'gid', 'updated_at'].includes(c));
      expect({ table, cols: local.sort() }).toEqual({ table, cols: [...syncedColumns[table]].sort() });
    }
  });
});
