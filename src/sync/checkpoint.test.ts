/**
 * @jest-environment node
 */
import { openDatabase } from '../db/driver';
import type { SQLiteDatabase } from '../db/driver';
import { migrate } from '../db/migrate';
import * as syncState from '../db/repositories/syncStateRepo';
import type { Bucket, ListedObject, PutOnceResult } from '../../sync-core/bucket';
import { checkpointKey, decodeCheckpoint } from '../../sync-core/codec';
import { checkpointPublisher, newestCheckpointHlc } from '../../sync-core/checkpointPolicy';
import type { CheckpointEntity } from '../../sync-core/types';
import { maybePublishCheckpoint } from './checkpoint';
import { gzip } from './gzip';

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

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const hlc = (wall: number, counter = 0) => `${String(wall).padStart(13, '0')}-${String(counter).padStart(4, '0')}`;

class FakeBucket implements Bucket {
  objects = new Map<string, Uint8Array>();
  lists = 0;
  failList = false;
  async list(prefix: string): Promise<ListedObject[]> {
    this.lists++;
    if (this.failList) throw new TypeError('Network request failed');
    return [...this.objects.keys()]
      .filter((k) => k.startsWith(prefix))
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
  async putOnce(key: string, bytes: Uint8Array): Promise<PutOnceResult> {
    if (this.objects.has(key)) return 'collision';
    this.objects.set(key, bytes);
    return 'written';
  }
}

const line = (id: string, stamps: Record<string, string>): CheckpointEntity => ({
  e: 'payees',
  id,
  exists: true,
  f: Object.fromEntries(Object.entries(stamps).map(([f, s]) => [f, { x: f, s }])),
  heads: {},
});

let n = 0;
let db: SQLiteDatabase;
let bucket: FakeBucket;

beforeEach(async () => {
  db = openDatabase(`ckpt${n++}.db`, '/documents/SQLite');
  await migrate(db);
  bucket = new FakeBucket();
  await syncState.setMeta(db, 'device', 'phone');
});

// Two writes by the phone and one by the browser, all after `wall`.
async function writesAfter(wall: number) {
  await syncState.saveEntities(db, [
    line('p1', { name: `${hlc(wall + 1)}@phone`, board_id: `${hlc(wall + 2)}@phone` }),
    line('p2', { name: `${hlc(wall + 3)}@browser` }),
  ]);
}

describe('checkpointPublisher', () => {
  it('picks the device with the most newer writes, ties to the smallest id', () => {
    const lines = [line('a', { name: `${hlc(5)}@zz` }), line('b', { name: `${hlc(6)}@aa` })];
    expect(checkpointPublisher(lines, null)).toBe('aa');
    expect(checkpointPublisher(lines, hlc(5))).toBe('aa');
    expect(checkpointPublisher(lines, hlc(6))).toBeNull();
  });

  it('reads the newest checkpoint from keys alone', () => {
    expect(newestCheckpointHlc([checkpointKey('b', hlc(9)), checkpointKey('a', hlc(10)), 'sync/checkpoints/x/junk'])).toBe(hlc(10));
    expect(newestCheckpointHlc([])).toBeNull();
  });
});

describe('maybePublishCheckpoint', () => {
  it('skips a checkpoint under a day old, with one list and nothing read', async () => {
    bucket.objects.set(checkpointKey('browser', hlc(NOW - DAY + 1)), new Uint8Array());
    await writesAfter(NOW - DAY + 1);
    expect(await maybePublishCheckpoint(db, bucket, NOW, gzip)).toBe('notDue');
    expect(bucket.lists).toBe(1);
  });

  it('leaves it to the device with more writes since the newest', async () => {
    const old = NOW - 2 * DAY;
    bucket.objects.set(checkpointKey('browser', hlc(old)), new Uint8Array());
    await syncState.saveEntities(db, [
      line('p1', { name: `${hlc(old + 1)}@browser`, board_id: `${hlc(old + 2)}@browser` }),
      line('p2', { name: `${hlc(old + 3)}@phone` }),
    ]);
    expect(await maybePublishCheckpoint(db, bucket, NOW, gzip)).toBe('notMine');
  });

  it('breaks a tie toward the smaller device id', async () => {
    const old = NOW - 2 * DAY;
    bucket.objects.set(checkpointKey('browser', hlc(old)), new Uint8Array());
    await syncState.saveEntities(db, [
      line('p1', { name: `${hlc(old + 1)}@phone` }),
      line('p2', { name: `${hlc(old + 2)}@browser` }),
    ]);
    expect(await maybePublishCheckpoint(db, bucket, NOW, gzip)).toBe('notMine');
    await syncState.setMeta(db, 'device', 'browser');
    expect(await maybePublishCheckpoint(db, bucket, NOW, gzip)).toBe('published');
  });

  it('waits while own segments are unsent', async () => {
    await writesAfter(NOW - 2 * DAY);
    await syncState.addSealed(db, { seq: 1, key: 'sync/log/phone/000000000001.ndjson.gz', bytes: new Uint8Array([1]) });
    expect(await maybePublishCheckpoint(db, bucket, NOW, gzip)).toBe('unsent');
  });

  it('publishes when due and this device wrote the most', async () => {
    const old = NOW - DAY;
    bucket.objects.set(checkpointKey('browser', hlc(old)), new Uint8Array());
    await writesAfter(old);
    expect(await maybePublishCheckpoint(db, bucket, NOW, gzip)).toBe('published');
    const key = checkpointKey('phone', hlc(old + 3));
    const cp = await decodeCheckpoint(gzip, bucket.objects.get(key)!);
    expect(cp.header.d).toBe('phone');
    expect(cp.entities.map((e) => e.id)).toEqual(['p1', 'p2']);
  });

  it('treats a failed list as nothing to do', async () => {
    bucket.failList = true;
    await writesAfter(NOW - 2 * DAY);
    expect(await maybePublishCheckpoint(db, bucket, NOW, gzip)).toBe('failed');
  });
});
