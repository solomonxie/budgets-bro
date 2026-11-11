/**
 * @jest-environment node
 */
import { gunzipSync, gzipSync } from 'zlib';
import { openDatabase } from '../db/driver';
import type { SQLiteDatabase } from '../db/driver';
import { migrate } from '../db/migrate';
import * as syncState from '../db/repositories/syncStateRepo';
import type { Bucket, ListedObject } from '../../sync-core/bucket';
import { encodeSegment, segmentKey } from '../../sync-core/codec';
import { format } from '../../sync-core/clock';
import type { Gzip, Scalar, VersionVector, WireOp } from '../../sync-core/types';
import { forgetState, pull } from './apply';

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

const NOW = 1_800_000_000_000;
const ME = 'phone';
const gzip: Gzip = {
  deflate: async (b) => new Uint8Array(gzipSync(b)),
  inflate: async (b) => new Uint8Array(gunzipSync(b)),
};

class FakeBucket implements Bucket {
  objects = new Map<string, { bytes: Uint8Array; lastModified: number }>();
  async list(prefix: string, opts: { startAfter?: string } = {}): Promise<ListedObject[]> {
    return [...this.objects.keys()]
      .filter((k) => k.startsWith(prefix) && (!opts.startAfter || k > opts.startAfter))
      .sort()
      .map((key) => ({ key, size: 0, etag: '', lastModified: this.objects.get(key)!.lastModified }));
  }
  async get(key: string) {
    return this.objects.get(key)?.bytes ?? null;
  }
  async head() {
    return null;
  }
  async put(key: string, bytes: Uint8Array) {
    this.objects.set(key, { bytes, lastModified: NOW });
  }
  async putOnce(key: string, bytes: Uint8Array) {
    await this.put(key, bytes);
    return 'written' as const;
  }
}

let db: SQLiteDatabase;
let bucket: FakeBucket;
let wall = NOW - 60_000;

const h = (w = ++wall) => format({ wall: w, counter: 0 });
const deps = () => ({ db, bucket, gzip, device: ME, now: () => NOW });

async function segment(d: string, seq: number, ops: WireOp[], vv: VersionVector = {}) {
  await bucket.put(`sync/devices/${d}.json`, new Uint8Array());
  await bucket.put(segmentKey(d, seq), await encodeSegment(gzip, d, seq, vv, ops));
}

const add = (e: string, id: string, x: Record<string, Scalar>, at = h()): WireOp => ({
  h: at,
  e,
  id,
  o: 'add',
  x: { deleted: null, ...x },
});
const set = (e: string, id: string, f: string, x: Scalar, at = h()): WireOp => ({ h: at, e, id, o: 'set', f, x });

// One board with an account, a category and a payee, all from device b.
function ledger(at = h()): WireOp[] {
  return [
    add('boards', 'B1', { name: 'Home', created_at: '2026-01-01' }, at),
    add('category_groups', 'G1', { board_id: 'B1', name: 'Bills', sort_order: 0, archived_at: null }, at),
    add('accounts', 'A1', { board_id: 'B1', name: 'Chequing', type: 'cash', on_budget: 1, opening_balance_cents: 0 }, at),
    add('accounts', 'A2', { board_id: 'B1', name: 'Savings', type: 'cash', on_budget: 1, opening_balance_cents: 0 }, at),
    add('categories', 'C1', { board_id: 'B1', group_id: 'G1', name: 'Rent', icon: null }, at),
    add('payees', 'P1', { board_id: 'B1', name: 'Landlord', linked_account_id: null }, at),
  ];
}
const txn = (id: string, x: Record<string, Scalar>, at = h()) =>
  add('transactions', id, { board_id: 'B1', account_id: 'A1', category_id: 'C1', payee_id: 'P1', memo: null, amount_cents: -100, date: '2026-11-01', import_id: null, ...x }, at);

const one = <T>(sql: string, ...p: (string | number)[]) => db.getFirstAsync<T>(sql, ...p);
const idOf = async (table: string, gid: string) =>
  (await one<{ id: number }>(`SELECT id FROM ${table} WHERE gid = ?`, gid))?.id ?? null;

beforeEach(async () => {
  db = openDatabase('apply.db', '/documents/SQLite');
  await migrate(db);
  await db.execAsync('PRAGMA foreign_keys = ON');
  bucket = new FakeBucket();
});

describe('pull', () => {
  it('writes new rows with FKs mapped to local ids, and records the echo range', async () => {
    const before = (await one<{ s: number | null }>('SELECT max(seq) AS s FROM change_log'))!.s ?? 0;
    await segment('b', 1, [...ledger(), txn('T1', { amount_cents: -2500 })]);

    const r = await pull(deps());
    expect(r).toEqual({ applied: 7, stopped: {} });

    const t = await one<{ account_id: number; category_id: number; payee_id: number; board_id: number; amount_cents: number }>(
      'SELECT * FROM transactions WHERE gid = ?',
      'T1',
    );
    expect(t).toMatchObject({
      amount_cents: -2500,
      account_id: await idOf('accounts', 'A1'),
      category_id: await idOf('categories', 'C1'),
      payee_id: await idOf('payees', 'P1'),
      board_id: await idOf('boards', 'B1'),
    });
    const after = (await one<{ s: number }>('SELECT max(seq) AS s FROM change_log'))!.s;
    expect(await syncState.remoteRangesAfter(db, 0)).toEqual([{ lo: before + 1, hi: after }]);
    expect(await syncState.getApplied(db)).toEqual({ b: { seq: 1, lastKey: segmentKey('b', 1) } });
  });

  it('updates only changed fields', async () => {
    await segment('b', 1, [...ledger(), txn('T1', {})]);
    await pull(deps());
    await segment('b', 2, [set('transactions', 'T1', 'amount_cents', -900)], { b: 1 });
    await pull(deps());
    expect((await one<{ amount_cents: number }>('SELECT amount_cents FROM transactions WHERE gid = ?', 'T1'))!.amount_cents).toBe(-900);
    const logged = await db.getAllAsync<{ before: string; after: string }>(
      "SELECT before, after FROM change_log WHERE tbl = 'transactions' AND op = 'update'",
    );
    expect(logged).toHaveLength(1);
  });

  it('deletes and undeletes, keeping the gid', async () => {
    await segment('b', 1, [...ledger(), txn('T1', { memo: 'rent' })]);
    await pull(deps());
    await segment('b', 2, [set('transactions', 'T1', 'deleted', NOW)], { b: 1 });
    await pull(deps());
    expect(await idOf('transactions', 'T1')).toBeNull();
    await segment('b', 3, [set('transactions', 'T1', 'deleted', null)], { b: 2 });
    await pull(deps());
    expect(await one('SELECT memo FROM transactions WHERE gid = ?', 'T1')).toEqual({ memo: 'rent' });
  });

  it('lands both legs of a transfer', async () => {
    const at = h();
    await segment('b', 1, [
      ...ledger(),
      txn('TA', { amount_cents: -500, transfer_account_id: 'A2', category_id: null }, at),
      txn('TB', { account_id: 'A2', amount_cents: 500, transfer_account_id: 'A1', category_id: null }, at),
    ]);
    await pull(deps());
    const rows = await db.getAllAsync<{ gid: string; account_id: number; transfer_account_id: number }>(
      "SELECT gid, account_id, transfer_account_id FROM transactions WHERE gid IN ('TA','TB') ORDER BY gid",
    );
    const a1 = await idOf('accounts', 'A1');
    const a2 = await idOf('accounts', 'A2');
    expect(rows).toEqual([
      { gid: 'TA', account_id: a1, transfer_account_id: a2 },
      { gid: 'TB', account_id: a2, transfer_account_id: a1 },
    ]);
  });

  it('collapses a duplicate payee onto the smallest gid and remaps its transactions', async () => {
    await segment('b', 1, [...ledger(), add('payees', 'pz', { board_id: 'B1', name: 'Costco' }), txn('T1', { payee_id: 'pz' })]);
    await pull(deps());
    expect(await idOf('payees', 'pz')).not.toBeNull();

    await segment('c', 1, [add('payees', 'pa', { board_id: 'B1', name: 'Costco' })], { b: 1 });
    await pull(deps());
    expect(await idOf('payees', 'pz')).toBeNull();
    const pa = await idOf('payees', 'pa');
    expect(await one('SELECT payee_id FROM transactions WHERE gid = ?', 'T1')).toEqual({ payee_id: pa });

    // A rename dissolves the group: the alias is a row again.
    await segment('c', 2, [set('payees', 'pa', 'name', 'Costco Wholesale')], { b: 1, c: 1 });
    await pull(deps());
    expect(await one('SELECT payee_id FROM transactions WHERE gid = ?', 'T1')).toEqual({ payee_id: await idOf('payees', 'pz') });
  });

  it('parks a row until its target arrives, then writes it', async () => {
    await segment('b', 1, ledger());
    await segment('c', 1, [txn('T1', { account_id: 'A9' })], { b: 1 });
    await pull(deps());
    expect(await idOf('transactions', 'T1')).toBeNull();

    await segment('b', 2, [add('accounts', 'A9', { board_id: 'B1', name: 'Visa', type: 'credit', on_budget: 1, opening_balance_cents: 0 })], { b: 1 });
    await pull(deps());
    expect(await one('SELECT account_id FROM transactions WHERE gid = ?', 'T1')).toEqual({ account_id: await idOf('accounts', 'A9') });
  });

  it('hides a row whose NOT NULL target is deleted, nulls a nullable one', async () => {
    await segment('b', 1, [...ledger(), txn('T1', {})]);
    await pull(deps());
    await segment('b', 2, [set('categories', 'C1', 'deleted', NOW)], { b: 1 });
    await pull(deps());
    expect(await one('SELECT category_id FROM transactions WHERE gid = ?', 'T1')).toEqual({ category_id: null });

    await segment('b', 3, [set('accounts', 'A1', 'deleted', NOW)], { b: 2 });
    await pull(deps());
    expect(await idOf('transactions', 'T1')).toBeNull();
    expect(await idOf('accounts', 'A1')).toBeNull();

    await segment('b', 4, [set('accounts', 'A1', 'deleted', null)], { b: 3 });
    await pull(deps());
    expect(await one('SELECT account_id FROM transactions WHERE gid = ?', 'T1')).toEqual({ account_id: await idOf('accounts', 'A1') });
  });

  it('is idempotent, including after reloading persisted state', async () => {
    await segment('b', 1, [...ledger(), txn('T1', {})]);
    await pull(deps());
    const count = async () => (await one<{ n: number }>('SELECT count(*) AS n FROM change_log'))!.n;
    const logged = await count();

    expect(await pull(deps())).toEqual({ applied: 0, stopped: {} });
    forgetState(db);
    await syncState.setApplied(db, 'b', { seq: 1, lastKey: '' }); // forces a re-list from the start
    expect(await pull(deps())).toEqual({ applied: 0, stopped: {} });
    expect(await count()).toBe(logged);

    await segment('b', 2, [set('transactions', 'T1', 'memo', 'after reload')], { b: 1 });
    await pull(deps());
    expect(await one('SELECT memo FROM transactions WHERE gid = ?', 'T1')).toEqual({ memo: 'after reload' });
  });

  it('stops a device at a gap and applies the rest later', async () => {
    await segment('b', 1, ledger());
    await segment('b', 3, [txn('T2', {})], { b: 2 });
    const r = await pull(deps());
    expect(r.stopped).toEqual({ b: 'gap' });
    expect(await idOf('transactions', 'T2')).toBeNull();

    await segment('b', 2, [txn('T1', {})], { b: 1 });
    expect((await pull(deps())).stopped).toEqual({});
    expect(await idOf('transactions', 'T2')).not.toBeNull();
  });

  it('refuses ops more than 24 h ahead and records the fatal clock state', async () => {
    await bucket.put(`sync/devices/b.json`, new Uint8Array());
    bucket.objects.set(segmentKey('b', 1), {
      bytes: await encodeSegment(gzip, 'b', 1, {}, ledger(h(NOW + 25 * 3_600_000))),
      lastModified: NOW + 25 * 3_600_000,
    });
    const r = await pull(deps());
    expect(r.stopped).toEqual({ b: 'clock' });
    expect(await idOf('boards', 'B1')).toBeNull();
    expect((await syncState.getMeta(db, 'fatal'))?.kind).toBe('clock');
  });

  it('marks a newer protocol version read-only for that device', async () => {
    await bucket.put(`sync/devices/b.json`, new Uint8Array());
    await bucket.put(segmentKey('b', 1), new Uint8Array(gzipSync('{"v":2,"d":"b","seq":1,"vv":{},"n":0}')));
    expect((await pull(deps())).stopped).toEqual({ b: 'newer' });
    expect((await syncState.getMeta(db, 'fatal'))?.kind).toBe('newer');
  });

  it('merges own sealed ops first, so an older remote edit cannot overwrite them', async () => {
    await segment('b', 1, [...ledger(), txn('T1', { memo: 'from b' })]);
    await pull(deps());
    const mine = h();
    const older = format({ wall: wall - 30_000, counter: 0 });
    await syncState.addSealed(db, {
      seq: 1,
      key: segmentKey(ME, 1),
      bytes: await encodeSegment(gzip, ME, 1, { b: 1 }, [set('transactions', 'T1', 'amount_cents', -4242, mine)]),
    });
    await segment('c', 1, [set('transactions', 'T1', 'amount_cents', -1, older)], { b: 1 });
    await pull(deps());
    expect(await one('SELECT amount_cents FROM transactions WHERE gid = ?', 'T1')).toEqual({ amount_cents: -4242 });
  });

  it('applies 2k ops quickly', async () => {
    const ops: WireOp[] = [...ledger()];
    for (let i = 0; i < 1000; i++) ops.push(txn(`T${i}`, { amount_cents: -i }));
    for (let i = 0; i < 1000; i++) ops.push(set('transactions', `T${i}`, 'memo', `m${i}`));
    for (let s = 0; s * 200 < ops.length; s++) {
      await segment('b', s + 1, ops.slice(s * 200, (s + 1) * 200), s ? { b: s } : {});
    }
    const started = Date.now();
    const r = await pull(deps());
    const ms = Date.now() - started;
    expect(r.applied).toBe(ops.length);
    expect((await one<{ n: number }>("SELECT count(*) AS n FROM transactions WHERE memo LIKE 'm%'"))!.n).toBe(1000);
    console.log(`applied ${ops.length} ops in ${ms} ms`);
    expect(ms).toBeLessThan(5000);
  });
});
