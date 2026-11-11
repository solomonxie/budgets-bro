/**
 * @jest-environment node
 */
import { openDatabase } from '../db/driver';
import type { SQLiteDatabase } from '../db/driver';
import { migrate } from '../db/migrate';
import * as syncState from '../db/repositories/syncStateRepo';
import type { Bucket, ListedObject } from '../../sync-core/bucket';
import { utf8ToBytes } from '../../sync-core/bytes';
import { enableBrowserSync, forgetSyncDevice, listSyncDevices, setEnvForTests } from './browserSync';

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
jest.mock('./s3Provider', () => ({ getS3Connection: async () => null }));
const mockDemo = jest.fn(async () => false);
jest.mock('../db/client', () => ({ isDemoMode: () => mockDemo() }));

const calls: string[] = [];
const mockBootstrap = jest.fn(async () => {
  calls.push('bootstrap');
  return 'already';
});
const mockPush = jest.fn(async (deps: { db: SQLiteDatabase }) => {
  calls.push('push');
  // Sealing moves the cursor past every row, as the real pusher does.
  const row = await deps.db.getFirstAsync<{ n: number }>('SELECT max(seq) AS n FROM change_log');
  await syncState.setMeta(deps.db, 'device', 'phone-1');
  await syncState.setMeta(deps.db, 'outboxCursor', row?.n ?? 0);
  return { sealed: 0, sent: 1 };
});
const mockPull = jest.fn(async (_deps: unknown) => {
  calls.push('pull');
  return { applied: 0, stopped: {} };
});
const mockSchedule = jest.fn();
jest.mock('./bootstrap', () => ({ ensureBootstrapped: (...a: unknown[]) => mockBootstrap(...(a as [])) }));
jest.mock('./push', () => ({
  push: (deps: { db: SQLiteDatabase }) => mockPush(deps),
  schedulePush: (db: unknown) => mockSchedule(db),
  flushNow: async () => null,
  setPushDeps: () => {},
}));
jest.mock('./apply', () => ({ pull: (deps: unknown) => mockPull(deps), forgetState: () => {} }));

class FakeBucket implements Bucket {
  objects = new Map<string, Uint8Array>();
  async list(prefix: string): Promise<ListedObject[]> {
    return [...this.objects.keys()]
      .filter((k) => k.startsWith(prefix))
      .map((key) => ({ key, size: 0, etag: '', lastModified: 0 }));
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
  async putOnce() {
    return 'written' as const;
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
}

let db: SQLiteDatabase;
let bucket: FakeBucket;

beforeEach(async () => {
  db = openDatabase('browser-sync.db', '/documents/SQLite');
  await migrate(db);
  bucket = new FakeBucket();
  setEnvForTests({
    bucketFor: async () => bucket,
    now: () => 1_800_000_000_000,
  });
  calls.length = 0;
  jest.clearAllMocks();
  mockDemo.mockResolvedValue(false);
});

afterAll(() => setEnvForTests(null));

const file = (o: object) => utf8ToBytes(JSON.stringify(o));

it('lists devices from the bucket, this phone first, then by last seen', async () => {
  await enableBrowserSync(db, 'cfg');
  await syncState.setMeta(db, 'device', 'phone-1');
  bucket.objects.set('sync/devices/phone-1.json', file({ name: 'iPhone', kind: 'phone', lastSeen: 5 }));
  bucket.objects.set('sync/devices/b1.json', file({ name: 'Chrome on Mac', kind: 'browser', lastSeen: 9 }));
  bucket.objects.set('sync/devices/b2.json', file({ name: 'Chrome on Windows', kind: 'browser', lastSeen: 7 }));
  bucket.objects.set('sync/devices/bad.json', utf8ToBytes('{'));
  const list = await listSyncDevices(db);
  expect(list.map((d) => [d.id, d.mine])).toEqual([
    ['phone-1', true],
    ['b1', false],
    ['b2', false],
  ]);
});

it('forget deletes only the device file and its cached name', async () => {
  await enableBrowserSync(db, 'cfg');
  bucket.objects.set('sync/devices/b1.json', file({ name: 'Chrome', kind: 'browser' }));
  bucket.objects.set('sync/log/b1/000000000001.ndjson.gz', new Uint8Array([1]));
  await syncState.setMeta(db, 'deviceNames', { b1: 'Chrome', b2: 'Other' });
  await forgetSyncDevice(db, 'b1');
  expect([...bucket.objects.keys()]).toEqual(['sync/log/b1/000000000001.ndjson.gz']);
  expect(await syncState.getMeta(db, 'deviceNames')).toEqual({ b2: 'Other' });
});
