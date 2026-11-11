import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Bucket, ListedObject, PutOnceResult } from '../../sync-core/bucket';
import { bytesToUtf8, utf8ToBytes } from '../../sync-core/bytes';
import { Clock, format } from '../../sync-core/clock';
import { checkpointKey, decodeSegment, encodeCheckpoint, encodeSegment, segmentKey } from '../../sync-core/codec';
import { SyncState } from '../../sync-core/merge';
import type { Scalar, Segment, VersionVector, WireOp } from '../../sync-core/types';
import { Store } from '../src/store/store';
import { ReadOnly, SyncEngine } from '../src/sync/engine';
import { streamGzip as gz } from '../src/sync/gzip';

const T0 = 1_793_414_025_000;
const PHONE = 'phone-0000';
const BROWSER = 'browser-0000';

class FakeBucket implements Bucket {
  objects = new Map<string, { bytes: Uint8Array; lastModified: number }>();
  gets: string[] = [];

  async list(prefix: string, opts: { startAfter?: string; max?: number } = {}): Promise<ListedObject[]> {
    const keys = [...this.objects.keys()]
      .filter((k) => k.startsWith(prefix) && (!opts.startAfter || k > opts.startAfter))
      .sort()
      .slice(0, opts.max ?? Infinity);
    return keys.map((key) => ({ key, size: this.objects.get(key)!.bytes.length, etag: '', lastModified: this.objects.get(key)!.lastModified }));
  }
  async get(key: string) {
    this.gets.push(key);
    return this.objects.get(key)?.bytes ?? null;
  }
  async head() {
    return null;
  }
  async put(key: string, bytes: Uint8Array) {
    this.objects.set(key, { bytes, lastModified: T0 + 30_000 });
  }
  async putOnce(key: string, bytes: Uint8Array): Promise<PutOnceResult> {
    const have = this.objects.get(key);
    if (!have) {
      await this.put(key, bytes);
      return 'written';
    }
    return bytesToUtf8(have.bytes) === bytesToUtf8(bytes) ? 'landed' : 'collision';
  }
}

const hlc = (n: number) => format({ wall: T0 + n, counter: 0 });

// The phone's ledger: board, account, group, category, one transaction; then an edit.
const phoneSegments: { seq: number; vv: VersionVector; ops: WireOp[] }[] = [
  {
    seq: 1,
    vv: {},
    ops: [
      { h: hlc(1), e: 'boards', id: 'b1', o: 'add', x: { name: 'Home', created_at: '2026-01-01', deleted: null } },
      { h: hlc(1), e: 'accounts', id: 'a1', o: 'add', x: { board_id: 'b1', name: 'Chequing', type: 'cash', on_budget: 1, deleted: null } },
      { h: hlc(1), e: 'accounts', id: 'a2', o: 'add', x: { board_id: 'b1', name: 'Savings', type: 'savings', on_budget: 1, deleted: null } },
      { h: hlc(1), e: 'category_groups', id: 'g1', o: 'add', x: { board_id: 'b1', name: 'Bills', deleted: null } },
      { h: hlc(1), e: 'categories', id: 'c1', o: 'add', x: { board_id: 'b1', group_id: 'g1', name: 'Rent', deleted: null } },
      {
        h: hlc(1),
        e: 'transactions',
        id: 't1',
        o: 'add',
        x: { board_id: 'b1', account_id: 'a1', category_id: 'c1', amount_cents: -100000, date: '2026-11-01', memo: 'rent', deleted: null },
      },
    ],
  },
  { seq: 2, vv: {}, ops: [{ h: hlc(2), e: 'transactions', id: 't1', o: 'set', f: 'amount_cents', x: -120000 }] },
];

async function putPhoneSegment(bucket: FakeBucket, s: { seq: number; vv: VersionVector; ops: WireOp[] }) {
  await bucket.put(segmentKey(PHONE, s.seq), await encodeSegment(gz, PHONE, s.seq, s.vv, s.ops));
}

const asSegment = (s: { seq: number; vv: VersionVector; ops: WireOp[] }, d = PHONE): Segment => ({
  d,
  seq: s.seq,
  vv: s.vv,
  ops: s.ops.map((op) => ({ ...op, d, seq: s.seq, vv: s.vv })),
  lastModified: T0 + 30_000,
});

// What the phone holds after `upTo` segments.
function phoneState(upTo: number): SyncState {
  const state = new SyncState();
  for (const s of phoneSegments.slice(0, upTo)) state.applySegment(asSegment(s));
  return state;
}

async function publishCheckpoint(bucket: FakeBucket, upTo: number) {
  const state = phoneState(upTo);
  const h = format(state.seen);
  await bucket.put(checkpointKey(PHONE, h), await encodeCheckpoint(gz, { d: PHONE, h, vv: state.vv }, state.checkpointEntities()));
}

let bucket: FakeBucket;
let store: Store;
let n = 0;

const open = () =>
  SyncEngine.open({ store, bucket, gzip: gz, clock: new Clock(undefined, () => T0 + 60_000), newId: () => BROWSER });

beforeEach(async () => {
  bucket = new FakeBucket();
  store = await Store.open(`sync-${n++}`);
  await bucket.put(`sync/devices/${PHONE}.json`, utf8ToBytes('{}'));
  for (const s of phoneSegments) await putPhoneSegment(bucket, s);
  await publishCheckpoint(bucket, 1);
});
afterEach(() => store.close());

const sealedOps = async (seq: number) => (await decodeSegment(gz, bucket.objects.get(segmentKey(BROWSER, seq))!.bytes, T0 + 30_000));

describe('load', () => {
  it('waits while the bucket has no checkpoint', async () => {
    bucket.objects.clear();
    const engine = await open();
    await engine.sync();
    expect(engine.status).toMatchObject({ ready: false, waiting: true });
    await expect(engine.edit('transactions', 't1', { memo: 'x' })).rejects.toThrow('not loaded');
  });

  it('checkpoint plus the log after it equals the phone', async () => {
    const engine = await open();
    await engine.sync();
    expect(engine.status).toMatchObject({ ready: true, waiting: false, readOnly: false });

    const phone = phoneState(2);
    for (const c of phone.changes()) {
      const stored = await store.get(c.e, c.id);
      expect(stored?.row ?? null).toEqual(c.row);
    }
    expect((await store.get('transactions', 't1'))?.row.amount_cents).toBe(-120000);
    // Only the checkpoint and the one segment after it were read.
    expect(bucket.gets.filter((k) => k.includes('/log/'))).toEqual([segmentKey(PHONE, 2)]);
  });

  it('reopens from its own store without downloading again', async () => {
    const first = await open();
    await first.sync();
    const before = bucket.gets.length;
    const again = await open();
    expect(again.status.ready).toBe(true);
    await again.sync();
    expect(bucket.gets.length).toBe(before);
    expect((await store.get('transactions', 't1'))?.row.amount_cents).toBe(-120000);
  });
});

describe('edits', () => {
  it('round-trips to a segment the phone can merge', async () => {
    const engine = await open();
    await engine.sync();
    await engine.edit('transactions', 't1', { memo: 'November rent' });
    expect((await store.get('transactions', 't1'))?.row.memo).toBe('November rent');
    expect(engine.status.pending).toBe(1);

    await engine.sync();
    expect(engine.status.pending).toBe(0);
    expect(bucket.objects.has(`sync/devices/${BROWSER}.json`)).toBe(true);

    const seg = await sealedOps(1);
    expect(seg).toMatchObject({ d: BROWSER, seq: 1, vv: { [PHONE]: 2 } });
    expect(seg.ops).toHaveLength(1);
    expect(seg.ops[0]).toMatchObject({ e: 'transactions', id: 't1', o: 'set', f: 'memo', x: 'November rent' });

    const phone = phoneState(2);
    expect(phone.applySegment(seg)).toBe(true);
    expect(phone.entities.get('transactions/t1')!.fields.get('memo')!.x).toBe('November rent');
    expect(phone.conflicts()).toEqual([]);
  });

  it('writes a transfer pair as one group with one tick', async () => {
    const engine = await open();
    await engine.sync();
    let out = '';
    let into = '';
    const leg = (account: string, amount: number, other: string): Record<string, Scalar> => ({
      board_id: 'b1',
      account_id: account,
      amount_cents: amount,
      date: '2026-11-05',
      transfer_account_id: other,
    });
    await engine.group((g) => {
      out = g.create('transactions', leg('a1', -5000, 'a2'));
      into = g.create('transactions', leg('a2', 5000, 'a1'));
    });
    await engine.sync();

    const seg = await sealedOps(1);
    expect(seg.ops.map((op) => [op.id, op.o])).toEqual(
      expect.arrayContaining([
        [out, 'add'],
        [into, 'add'],
      ]),
    );
    expect(new Set(seg.ops.map((op) => op.h)).size).toBe(1);
    expect((seg.ops[0]!.x as Record<string, Scalar>).deleted).toBeNull();
  });

  it('records a delete as the deleted field', async () => {
    const engine = await open();
    await engine.sync();
    await engine.remove('transactions', 't1');
    expect(await store.get('transactions', 't1')).toBeUndefined();
    await engine.sync();
    const op = (await sealedOps(1)).ops[0]!;
    expect(op).toMatchObject({ o: 'set', f: 'deleted' });
    expect(typeof op.x).toBe('number');
  });

  it('seals before applying anything pulled', async () => {
    const engine = await open();
    await engine.sync();
    await engine.edit('transactions', 't1', { memo: 'mine' });
    await putPhoneSegment(bucket, { seq: 3, vv: {}, ops: [{ h: hlc(3), e: 'transactions', id: 't1', o: 'set', f: 'memo', x: 'phone' }] });

    await engine.pull();
    // The edit went out under the vv it was made with, before seq 3 merged.
    const [sealed] = await store.sealed();
    const seg = await decodeSegment(gz, sealed!.bytes, T0 + 30_000);
    expect(seg.vv).toEqual({ [PHONE]: 2 });
    // Neither saw the other: a conflict, both values kept.
    expect(engine.status.conflicts.map((c) => c.x)).toHaveLength(1);
  });
});

describe('checkpoints', () => {
  it('publishes when due and this browser wrote the most since the last', async () => {
    const engine = await open();
    await engine.sync();
    await engine.edit('transactions', 't1', { memo: 'a', amount_cents: -1, date: '2026-11-02' });
    // A day after the phone's checkpoint, in bucket time.
    (engine as unknown as { clock: Clock }).clock = new Clock(undefined, () => T0 + 86_400_000 + 60_000);
    await engine.sync();
    const mine = [...bucket.objects.keys()].filter((k) => k.startsWith(`sync/checkpoints/${BROWSER}/`));
    expect(mine).toHaveLength(1);
  });

  it('leaves it to the phone when the phone wrote more', async () => {
    const engine = await open();
    await engine.sync();
    (engine as unknown as { clock: Clock }).clock = new Clock(undefined, () => T0 + 86_400_000 + 60_000);
    await engine.sync();
    expect([...bucket.objects.keys()].some((k) => k.startsWith(`sync/checkpoints/${BROWSER}/`))).toBe(false);
  });
});

describe('fatal states', () => {
  it('stops writing on a collision', async () => {
    const engine = await open();
    await engine.sync();
    await engine.edit('transactions', 't1', { memo: 'mine' });
    await bucket.put(segmentKey(BROWSER, 1), utf8ToBytes('someone else'));
    // The prefix is no longer empty either way: no write lands.
    await engine.sync();
    expect(engine.status.fatal?.kind).toBe('collision');
    expect(engine.status.readOnly).toBe(true);
    await expect(engine.edit('transactions', 't1', { memo: 'again' })).rejects.toBeInstanceOf(ReadOnly);
    expect(bytesToUtf8(bucket.objects.get(segmentKey(BROWSER, 1))!.bytes)).toBe('someone else');
  });

  it('goes read-only on a newer protocol version', async () => {
    const engine = await open();
    await engine.sync();
    const lines = [JSON.stringify({ v: 2, d: PHONE, seq: 3, vv: {}, n: 0 })];
    await bucket.put(segmentKey(PHONE, 3), await gz.deflate(utf8ToBytes(lines.join('\n'))));
    await engine.sync();
    expect(engine.status.fatal?.kind).toBe('newer');
    expect(engine.status.readOnly).toBe(true);
    await expect(engine.edit('transactions', 't1', { memo: 'x' })).rejects.toBeInstanceOf(ReadOnly);
  });
});
