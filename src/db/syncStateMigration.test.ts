/**
 * @jest-environment node
 */
import { openDatabase } from './driver';
import type { SQLiteDatabase } from './driver';
import { migrate } from './migrate';
import * as repo from './repositories/syncStateRepo';
import type { CheckpointEntity } from '../../sync-core/types';

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

beforeEach(async () => {
  db = openDatabase('sync.db', '/documents/SQLite');
  await migrate(db);
});

const line = (id: string, heads: number): CheckpointEntity => ({
  e: 'transactions',
  id,
  exists: true,
  f: { memo: { x: 'a', s: '1793414025123-0000@d' } },
  heads: { memo: Array.from({ length: heads }, (_, i) => ({ x: `v${i}`, s: `s${i}`, seq: 1, vv: {} })) },
});

it('round-trips meta values with their types', async () => {
  expect(await repo.getMeta(db, 'device')).toBeNull();
  await repo.setMeta(db, 'device', 'abc');
  await repo.setMeta(db, 'outboxCursor', 42);
  await repo.setMeta(db, 'fatal', { kind: 'collision', detail: 'k', at: 1 });
  await repo.setMeta(db, 'outboxCursor', 43);
  expect(await repo.getMeta(db, 'device')).toBe('abc');
  expect(await repo.getMeta(db, 'outboxCursor')).toBe(43);
  expect(await repo.getMeta(db, 'fatal')).toEqual({ kind: 'collision', detail: 'k', at: 1 });
});

it('tracks applied seq per device as a version vector', async () => {
  await repo.setApplied(db, 'a', { seq: 1, lastKey: 'k1' });
  await repo.setApplied(db, 'a', { seq: 2, lastKey: 'k2' });
  await repo.setApplied(db, 'b', { seq: 5, lastKey: 'k5' });
  expect(await repo.getVersionVector(db)).toEqual({ a: 2, b: 5 });
  expect((await repo.getApplied(db)).a).toEqual({ seq: 2, lastKey: 'k2' });
});

it('keeps remote ranges past the cursor and prunes the rest', async () => {
  await repo.addRemoteRange(db, { lo: 1, hi: 5 });
  await repo.addRemoteRange(db, { lo: 9, hi: 12 });
  await repo.addRemoteRange(db, { lo: 20, hi: 19 });
  expect(await repo.remoteRangesAfter(db, 5)).toEqual([{ lo: 9, hi: 12 }]);
  await repo.pruneRemoteRanges(db, 5);
  expect(await repo.remoteRangesAfter(db, 0)).toEqual([{ lo: 9, hi: 12 }]);
});

it('stores sealed segment bytes unchanged', async () => {
  const bytes = new Uint8Array([0, 1, 2, 255]);
  await repo.addSealed(db, { seq: 1, key: 'sync/log/d/000000000001.ndjson.gz', bytes });
  const [sealed] = await repo.listSealed(db);
  expect(Array.from(sealed.bytes)).toEqual([0, 1, 2, 255]);
  await repo.deleteSealed(db, 1);
  expect(await repo.listSealed(db)).toEqual([]);
});

it('persists merge state and indexes conflicted entities', async () => {
  await repo.saveEntities(db, [line('x', 1), line('y', 2)]);
  await repo.saveEntities(db, [line('x', 3)]);
  expect((await repo.loadEntities(db)).map((l) => l.id).sort()).toEqual(['x', 'y']);
  expect((await repo.conflictedEntities(db)).map((l) => l.id).sort()).toEqual(['x', 'y']);
  await repo.saveEntities(db, [line('y', 1)]);
  expect((await repo.conflictedEntities(db)).map((l) => l.id)).toEqual(['x']);
});

it('writes nothing to change_log and resets cleanly', async () => {
  const before = (await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM change_log'))!.n;
  await repo.setMeta(db, 'device', 'abc');
  await repo.saveEntities(db, [line('x', 1)]);
  await repo.addSealed(db, { seq: 1, key: 'k', bytes: new Uint8Array([1]) });
  expect((await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM change_log'))!.n).toBe(before);
  await repo.resetSyncState(db);
  expect(await repo.getMeta(db, 'device')).toBeNull();
  expect(await repo.loadEntities(db)).toEqual([]);
  expect(await repo.listSealed(db)).toEqual([]);
});
