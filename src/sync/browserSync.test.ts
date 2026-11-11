/**
 * @jest-environment node
 */
import { openDatabase } from '../db/driver';
import type { SQLiteDatabase } from '../db/driver';
import { migrate } from '../db/migrate';
import * as boardsRepo from '../db/repositories/boardsRepo';
import * as accountsRepo from '../db/repositories/accountsRepo';
import * as syncState from '../db/repositories/syncStateRepo';
import type { Bucket, ListedObject } from '../../sync-core/bucket';
import { utf8ToBytes } from '../../sync-core/bytes';
import {
  disableBrowserSync,
  enableBrowserSync,
  getBrowserSyncStatus,
  noteLocalWrite,
  onRemoteChange,
  setEnvForTests,
  syncNow,
} from './browserSync';

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
}

let db: SQLiteDatabase;
let bucket: FakeBucket;
let bucketCalls: number;

beforeEach(async () => {
  db = openDatabase('browser-sync.db', '/documents/SQLite');
  await migrate(db);
  bucket = new FakeBucket();
  bucketCalls = 0;
  setEnvForTests({
    bucketFor: async () => {
      bucketCalls++;
      return bucket;
    },
    now: () => 1_800_000_000_000,
  });
  calls.length = 0;
  jest.clearAllMocks();
  mockDemo.mockResolvedValue(false);
});

afterAll(() => setEnvForTests(null));

it('does nothing while off, and a write costs no push', async () => {
  expect(await syncNow(db)).toEqual({ skipped: 'disabled' });
  await noteLocalWrite(db);
  expect(bucketCalls).toBe(0);
  expect(mockSchedule).not.toHaveBeenCalled();
  expect(calls).toEqual([]);
});

it('does nothing in demo mode, even when switched on', async () => {
  await enableBrowserSync(db, 'cfg');
  mockDemo.mockResolvedValue(true);
  expect(await syncNow(db)).toEqual({ skipped: 'demo' });
  expect(calls).toEqual([]);
});

it('bootstraps, seals and pushes before it pulls; no remote change, no refresh', async () => {
  await enableBrowserSync(db, 'cfg');
  const refresh = jest.fn();
  const off = onRemoteChange(refresh);
  expect(await syncNow(db)).toEqual({ applied: 0, sent: 1 });
  off();
  expect(calls).toEqual(['bootstrap', 'push', 'pull']);
  expect(refresh).not.toHaveBeenCalled();
  expect((await getBrowserSyncStatus(db)).lastSynced).toBe(1_800_000_000_000);
});

it('refreshes screens and pushes again after an apply that changed rows', async () => {
  await enableBrowserSync(db, 'cfg');
  mockPull.mockImplementationOnce(async () => {
    calls.push('pull');
    return { applied: 3, stopped: {} };
  });
  const refresh = jest.fn(() => calls.push('refresh'));
  const off = onRemoteChange(refresh);
  await syncNow(db);
  off();
  expect(calls).toEqual(['bootstrap', 'push', 'pull', 'refresh', 'push']);
});

it('reseals before pulling when a write lands after the push', async () => {
  await enableBrowserSync(db, 'cfg');
  const board = await boardsRepo.createBoard(db, 'B');
  mockPush.mockImplementationOnce(async (deps) => {
    calls.push('push');
    await syncState.setMeta(deps.db, 'device', 'phone-1');
    // Leaves the new account's row unsealed.
    await accountsRepo.createAccount(db, board, { name: 'Cash', type: 'cash', openingBalanceCents: 0 } as never);
    return { sealed: 0, sent: 0 };
  });
  await syncNow(db);
  expect(calls).toEqual(['bootstrap', 'push', 'push', 'pull']);
});

it('schedules a push after a write once switched on', async () => {
  await enableBrowserSync(db, 'cfg');
  await noteLocalWrite(db);
  expect(mockSchedule).toHaveBeenCalledWith(db);
  await disableBrowserSync(db);
  mockSchedule.mockClear();
  await noteLocalWrite(db);
  expect(mockSchedule).not.toHaveBeenCalled();
});

it('records offline instead of throwing', async () => {
  await enableBrowserSync(db, 'cfg');
  mockPull.mockImplementationOnce(async () => {
    throw new TypeError('Network request failed');
  });
  expect(await syncNow(db)).toEqual({ error: 'offline' });
  expect((await getBrowserSyncStatus(db)).error?.kind).toBe('offline');
});

it('reads other devices names once per pull', async () => {
  await enableBrowserSync(db, 'cfg');
  bucket.objects.set('sync/devices/web-1.json', utf8ToBytes(JSON.stringify({ name: 'Chrome on Mac' })));
  bucket.objects.set('sync/devices/phone-1.json', utf8ToBytes(JSON.stringify({ name: 'iPhone' })));
  await syncNow(db);
  expect(await syncState.getMeta(db, 'deviceNames')).toEqual({ 'web-1': 'Chrome on Mac' });
});

it('a different home config starts this device over', async () => {
  await enableBrowserSync(db, 'cfg');
  await syncState.setMeta(db, 'device', 'phone-1');
  await enableBrowserSync(db, 'cfg');
  expect(await syncState.getMeta(db, 'device')).toBe('phone-1');
  await enableBrowserSync(db, 'other');
  expect(await syncState.getMeta(db, 'device')).toBeNull();
  expect(await syncState.getMeta(db, 'homeConfig')).toBe('other');
});

it('stops when bootstrap cannot finish', async () => {
  await enableBrowserSync(db, 'cfg');
  mockBootstrap.mockImplementationOnce(async () => {
    calls.push('bootstrap');
    return 'busy';
  });
  expect(await syncNow(db)).toEqual({ stopped: 'busy' });
  expect(calls).toEqual(['bootstrap']);
});

it('reports a missing home bucket', async () => {
  await enableBrowserSync(db, 'cfg');
  setEnvForTests({ bucketFor: async () => null, now: () => 1 });
  expect(await syncNow(db)).toEqual({ error: 'missing' });
});
