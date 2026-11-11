/**
 * @jest-environment node
 */
import { gunzipSync, gzipSync } from 'zlib';
import { openDatabase } from '../db/driver';
import type { SQLiteDatabase } from '../db/driver';
import { migrate } from '../db/migrate';
import * as boardsRepo from '../db/repositories/boardsRepo';
import * as accountsRepo from '../db/repositories/accountsRepo';
import * as syncState from '../db/repositories/syncStateRepo';
import type { Bucket, ListedObject, PutOnceResult } from '../../sync-core/bucket';
import { decodeSegment } from '../../sync-core/codec';
import { gzip } from './gzip';
import { flushNow, push, schedulePush, setPushDeps } from './push';
import type { PushDeps } from './push';

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

const NOW = 1_800_000_000_000;
let clock = NOW;

class FakeBucket implements Bucket {
  objects = new Map<string, Uint8Array>();
  puts: { key: string; bytes: Uint8Array }[] = [];
  failNext = 0;
  async list(prefix: string): Promise<ListedObject[]> {
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
    this.puts.push({ key, bytes });
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error('network');
    }
    const existing = this.objects.get(key);
    if (existing) return Buffer.compare(existing, bytes) === 0 ? 'landed' : 'collision';
    this.objects.set(key, bytes);
    return 'written';
  }
}

let db: SQLiteDatabase;
let bucket: FakeBucket;
let boardId: number;

const deps = (): PushDeps => ({ db, bucket, gzip, now: () => clock, deviceName: 'Test iPhone' });
const logKeys = () => [...bucket.objects.keys()].filter((k) => k.startsWith('sync/log/'));
const cash = (name: string) =>
  accountsRepo.createAccount(db, boardId, { name, type: 'cash', openingBalanceCents: 0 } as never);

beforeEach(async () => {
  clock = NOW;
  mockDemo.mockResolvedValue(false);
  db = openDatabase('push.db', '/documents/SQLite');
  await migrate(db);
  boardId = await boardsRepo.createBoard(db, 'Home');
  bucket = new FakeBucket();
});

describe('gzip', () => {
  it('round-trips with zlib both ways, empty input included', async () => {
    for (const text of ['', 'hello', 'x'.repeat(100_000), '中文 payee']) {
      const bytes = new TextEncoder().encode(text);
      expect(new Uint8Array(gunzipSync(await gzip.deflate(bytes)))).toEqual(bytes);
      expect(await gzip.inflate(new Uint8Array(gzipSync(bytes)))).toEqual(bytes);
    }
  });

  it('rejects a corrupted member', async () => {
    const gz = await gzip.deflate(new TextEncoder().encode('hello world'));
    gz[gz.length - 8] ^= 0xff;
    await expect(gzip.inflate(gz)).rejects.toThrow();
  });
});

describe('push', () => {
  it('seals and sends the outbox, then publishes the device file', async () => {
    await cash('Chequing');
    const r = await push(deps());
    expect(r).toEqual({ sealed: 1, sent: 1 });

    const device = (await syncState.getMeta(db, 'device'))!;
    expect(logKeys()).toEqual([`sync/log/${device}/000000000001.ndjson.gz`]);
    const seg = await decodeSegment(gzip, bucket.objects.get(logKeys()[0])!, NOW);
    expect(seg.d).toBe(device);
    expect(seg.ops.some((op) => op.e === 'accounts' && op.o === 'add')).toBe(true);

    const file = JSON.parse(new TextDecoder().decode(bucket.objects.get(`sync/devices/${device}.json`)!));
    expect(file).toEqual({ device, name: 'Test iPhone', kind: 'phone', created: NOW, lastSeen: NOW });
    expect(await syncState.listSealed(db)).toEqual([]);
    expect(await syncState.getMeta(db, 'nextSeq')).toBe(2);
  });

  it('persists cursor, hlc, seq and sealed bytes together', async () => {
    await cash('Chequing');
    bucket.failNext = 1;
    await expect(push(deps())).rejects.toThrow('network');
    const sealed = await syncState.listSealed(db);
    expect(sealed).toHaveLength(1);
    expect(await syncState.getMeta(db, 'outboxCursor')).toBeGreaterThan(0);
    expect(await syncState.getMeta(db, 'hlc')).not.toBeNull();
    expect(await syncState.getMeta(db, 'nextSeq')).toBe(2);
  });

  it('retries with identical bytes and treats an earlier landing as sent', async () => {
    await cash('Chequing');
    bucket.failNext = 1;
    await expect(push(deps())).rejects.toThrow();
    const [first] = bucket.puts;
    const r = await push(deps());
    expect(r.sent).toBe(1);
    expect(bucket.puts[1]).toEqual(first);
    expect(await syncState.listSealed(db)).toEqual([]);
  });

  it('counts an existing identical object as landed', async () => {
    await cash('Chequing');
    bucket.failNext = 1;
    await expect(push(deps())).rejects.toThrow();
    const [{ key, bytes }] = bucket.puts;
    bucket.objects.set(key, bytes);
    expect(await push(deps())).toEqual({ sealed: 0, sent: 1 });
  });

  it('stops for good on a collision', async () => {
    await cash('Chequing');
    bucket.failNext = 1;
    await expect(push(deps())).rejects.toThrow();
    const [{ key }] = bucket.puts;
    bucket.objects.set(key, new Uint8Array([1, 2, 3]));
    expect((await push(deps())).stopped).toBe('collision');
    expect((await syncState.getMeta(db, 'fatal'))?.kind).toBe('collision');

    await cash('Savings');
    const puts = bucket.puts.length;
    expect((await push(deps())).stopped).toBe('fatal');
    expect(bucket.puts.length).toBe(puts);
  });

  it('refuses to write into a device prefix that already has segments', async () => {
    await syncState.setMeta(db, 'device', 'dev-1');
    bucket.objects.set('sync/log/dev-1/000000000001.ndjson.gz', new Uint8Array([9]));
    await cash('Chequing');
    expect((await push(deps())).stopped).toBe('collision');
    expect((await syncState.getMeta(db, 'fatal'))?.detail).toContain('not empty');
    expect(bucket.puts).toEqual([]);
  });

  it('refreshes the device file at most daily', async () => {
    await cash('Chequing');
    await push(deps());
    const device = (await syncState.getMeta(db, 'device'))!;
    const seen = () =>
      JSON.parse(new TextDecoder().decode(bucket.objects.get(`sync/devices/${device}.json`)!)).lastSeen;
    clock = NOW + 3_600_000;
    await push(deps());
    expect(seen()).toBe(NOW);
    clock = NOW + 86_400_000;
    await push(deps());
    expect(seen()).toBe(NOW + 86_400_000);
  });

  it('seals against other devices only in its vv', async () => {
    const device = 'dev-me';
    await syncState.setMeta(db, 'device', device);
    await syncState.setApplied(db, device, { seq: 4, lastKey: 'x' });
    await syncState.setApplied(db, 'other', { seq: 7, lastKey: 'y' });
    await cash('Chequing');
    await push(deps());
    const seg = await decodeSegment(gzip, bucket.objects.get(logKeys()[0])!, NOW);
    expect(seg.vv).toEqual({ other: 7 });
  });

  it('never pushes demo data', async () => {
    mockDemo.mockResolvedValue(true);
    await cash('Chequing');
    expect((await push(deps())).stopped).toBe('demo');
    expect(bucket.puts).toEqual([]);
  });

  it('sends nothing while a transaction is open', async () => {
    await cash('Chequing');
    let result: Awaited<ReturnType<typeof push>> | undefined;
    await db.withTransactionAsync(async () => {
      await cash('Savings');
      result = await push(deps());
    });
    expect(result?.sent).toBe(0);
    expect(bucket.puts).toEqual([]);
  });
});

describe('schedulePush', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    setPushDeps(null);
  });

  it('sends after 2 s of quiet, restarting on each write', async () => {
    setPushDeps(async () => deps());
    await cash('Chequing');
    schedulePush(db);
    await jest.advanceTimersByTimeAsync(1500);
    schedulePush(db);
    await jest.advanceTimersByTimeAsync(1500);
    expect(bucket.puts).toEqual([]);
    await jest.advanceTimersByTimeAsync(600);
    expect(bucket.puts).toHaveLength(1);
  });

  it('flushNow is a no-op with sync off', async () => {
    await cash('Chequing');
    expect(await flushNow(db)).toBeNull();
  });
});
