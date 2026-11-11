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
import { buildOutbox } from './outbox';
import { conflictedRowIds, conflictsForRow, forgetSyncPresence, listConflicts, resolveConflict } from './conflicts';

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
jest.mock('../db/client', () => ({ isDemoMode: async () => false }));

const NOW = 1_800_000_000_000;
const ME = 'phone';
const gzip: Gzip = {
  deflate: async (b) => new Uint8Array(gzipSync(b)),
  inflate: async (b) => new Uint8Array(gunzipSync(b)),
};

class FakeBucket implements Bucket {
  objects = new Map<string, Uint8Array>();
  async list(prefix: string, opts: { startAfter?: string } = {}): Promise<ListedObject[]> {
    return [...this.objects.keys()]
      .filter((k) => k.startsWith(prefix) && (!opts.startAfter || k > opts.startAfter))
      .sort()
      .map((key) => ({ key, size: 0, etag: '', lastModified: NOW }));
  }
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
  async head() {
    return null;
  }
  async put(key: string, bytes: Uint8Array) {
    this.objects.set(key, bytes);
  }
  async putOnce(key: string, bytes: Uint8Array) {
    await this.put(key, bytes);
    return 'written' as const;
  }
}

let db: SQLiteDatabase;
let bucket: FakeBucket;
let wall = NOW - 60_000;
const h = () => format({ wall: ++wall, counter: 0 });
const deps = () => ({ db, bucket, gzip, device: ME, now: () => NOW });

async function segment(d: string, seq: number, ops: WireOp[], vv: VersionVector = {}) {
  await bucket.put(`sync/devices/${d}.json`, new Uint8Array());
  await bucket.put(segmentKey(d, seq), await encodeSegment(gzip, d, seq, vv, ops));
}
const add = (e: string, id: string, x: Record<string, Scalar>): WireOp => ({ h: h(), e, id, o: 'add', x: { deleted: null, ...x } });
const set = (e: string, id: string, f: string, x: Scalar): WireOp => ({ h: h(), e, id, o: 'set', f, x });

const ledger = () => [
  add('boards', 'B1', { name: 'Home', created_at: '2026-01-01' }),
  add('accounts', 'A1', { board_id: 'B1', name: 'Chequing', type: 'cash', on_budget: 1, opening_balance_cents: 0 }),
  add('transactions', 'T1', { board_id: 'B1', account_id: 'A1', memo: 'pay', amount_cents: 320000, date: '2026-09-14' }),
];

// b and c both edit T1's memo after seeing only b's first segment.
async function concurrentMemoEdits() {
  await segment('b', 1, ledger());
  await pull(deps());
  await segment('b', 2, [set('transactions', 'T1', 'memo', 'September salary')], { b: 1 });
  await segment('c', 1, [set('transactions', 'T1', 'memo', 'Sept pay + bonus')], { b: 1 });
  await pull(deps());
}

const idOf = async (gid: string) =>
  (await db.getFirstAsync<{ id: number }>('SELECT id FROM transactions WHERE gid = ?', gid))!.id;

beforeEach(async () => {
  db = openDatabase('conflicts.db', '/documents/SQLite');
  await migrate(db);
  forgetState(db);
  bucket = new FakeBucket();
});

describe('conflicts', () => {
  it('stays silent, with no queries, before sync has a device', async () => {
    await concurrentMemoEdits();
    forgetSyncPresence(db);
    expect(await listConflicts(db)).toEqual([]);
    const spy = jest.spyOn(db, 'getAllAsync');
    const first = jest.spyOn(db, 'getFirstAsync');
    expect(await listConflicts(db)).toEqual([]);
    expect(await conflictedRowIds(db, 'transactions')).toEqual(new Set());
    expect(spy).not.toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
  });

  it('lists both values, newest first, and marks the row', async () => {
    await syncState.setMeta(db, 'device', ME);
    await syncState.setMeta(db, 'deviceNames', { b: 'Chrome on Mac' });
    forgetSyncPresence(db);
    await concurrentMemoEdits();

    const [c] = await conflictsForRow(db, 'transactions', await idOf('T1'));
    expect(c).toMatchObject({
      table: 'transactions',
      gid: 'T1',
      field: 'memo',
      current: { value: 'Sept pay + bonus', device: 'c', deviceName: null, mine: false },
      others: [{ value: 'September salary', device: 'b', deviceName: 'Chrome on Mac', mine: false }],
    });
    expect(await db.getFirstAsync('SELECT memo FROM transactions WHERE gid = ?', 'T1')).toEqual({
      memo: 'Sept pay + bonus',
    });
    expect(await conflictedRowIds(db, 'transactions')).toEqual(new Set([await idOf('T1')]));
  });

  it('resolves with a set that supersedes both heads, even when keeping the current value', async () => {
    await syncState.setMeta(db, 'device', ME);
    forgetSyncPresence(db);
    await concurrentMemoEdits();
    const [c] = await listConflicts(db);

    await resolveConflict(db, c, c.current.value);
    expect(await listConflicts(db)).toEqual([]);
    expect(await db.getFirstAsync('SELECT memo FROM transactions WHERE gid = ?', 'T1')).toEqual({
      memo: 'Sept pay + bonus',
    });

    const batch = await buildOutbox(db, () => NOW);
    const ops = batch!.groups.flat();
    expect(ops).toEqual([expect.objectContaining({ e: 'transactions', id: 'T1', o: 'set', f: 'memo', x: 'Sept pay + bonus' })]);

    // Once the phone's own segment is merged back, the merge state agrees.
    await segment(ME, 1, ops, await syncState.getVersionVector(db));
    await pull(deps());
    expect(await syncState.conflictedEntities(db)).toEqual([]);
  });

  it('shows the conflict again when a new concurrent edit arrives after resolving', async () => {
    await syncState.setMeta(db, 'device', ME);
    forgetSyncPresence(db);
    await concurrentMemoEdits();
    const [c] = await listConflicts(db);
    await resolveConflict(db, c, c.others[0].value);
    expect(await listConflicts(db)).toEqual([]);

    // d edits without having seen b or c.
    await segment('d', 1, [set('transactions', 'T1', 'memo', 'salary')], { b: 1 });
    await pull(deps());
    expect((await listConflicts(db)).map((x) => x.field)).toEqual(['memo']);
  });
});
