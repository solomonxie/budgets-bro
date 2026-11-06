import { gunzipSync, gzipSync } from 'zlib';
import {
  checkpointKey,
  cutSegments,
  decodeCheckpoint,
  decodeSegment,
  encodeCheckpoint,
  encodeSegment,
  hlcOfCheckpointKey,
  segmentKey,
  seqOf,
} from './codec';
import { utf8ToBytes } from './bytes';
import { type CheckpointEntity, type Group, type Gzip, NewerProtocol, type WireOp } from './types';

const gz: Gzip = {
  deflate: async (b) => new Uint8Array(gzipSync(b)),
  inflate: async (b) => new Uint8Array(gunzipSync(b)),
};

const op = (h: string, id: string, f = 'memo', x: string | number | null = 'x'): WireOp => ({
  h,
  e: 'transactions',
  id,
  o: 'set',
  f,
  x,
});

const group = (h: string, n: number, x = 'x'): Group =>
  Array.from({ length: n }, (_, i) => op(h, `id${i}`, 'memo', x));

describe('keys', () => {
  it('formats and parses segment keys', () => {
    const key = segmentKey('dev', 42);
    expect(key).toBe('sync/log/dev/000000000042.ndjson.gz');
    expect(seqOf(key)).toBe(42);
    expect(seqOf('sync/log/dev/devices.json')).toBeNull();
  });

  it('formats checkpoint keys from an hlc', () => {
    const key = checkpointKey('dev', { wall: 1793414025123, counter: 3 });
    expect(key).toBe('sync/checkpoints/dev/1793414025123-0003.ndjson.gz');
    expect(hlcOfCheckpointKey(key)).toBe('1793414025123-0003');
  });
});

describe('segments', () => {
  it('round-trips header and ops, Unicode included', async () => {
    const ops = [
      op('1793414025123-0000', 'a', 'memo', '超市 groceries'),
      { h: '1793414025123-0000', e: 'payees', id: 'p', o: 'add' as const, x: { name: 'Costco', deleted: null } },
      op('1793414025123-0001', 'a', 'amount_cents', -1250),
      op('1793414025123-0002', 'a', 'category_id', null),
    ];
    const bytes = await encodeSegment(gz, 'dev', 7, { other: 3 }, ops);
    const seg = await decodeSegment(gz, bytes, 99);
    expect(seg).toMatchObject({ d: 'dev', seq: 7, vv: { other: 3 }, lastModified: 99 });
    expect(seg.ops.map(({ d: _d, seq: _s, vv: _v, ...w }) => w)).toEqual(ops);
    expect(seg.ops.every((o) => o.d === 'dev' && o.seq === 7 && o.vv.other === 3)).toBe(true);
  });

  it('writes the header line exactly as specified', async () => {
    const bytes = await encodeSegment(gz, 'dev', 1, {}, [op('1793414025123-0000', 'a')]);
    const lines = gunzipSync(bytes).toString('utf8').split('\n');
    expect(JSON.parse(lines[0])).toEqual({ v: 1, d: 'dev', seq: 1, vv: {}, n: 1 });
    expect(lines).toHaveLength(2);
  });

  it('rejects a newer protocol version', async () => {
    const bytes = new Uint8Array(gzipSync(utf8ToBytes('{"v":2,"d":"dev","seq":1,"vv":{},"n":0}')));
    await expect(decodeSegment(gz, bytes, 0)).rejects.toBeInstanceOf(NewerProtocol);
  });

  it('rejects a truncated segment', async () => {
    const bytes = new Uint8Array(gzipSync(utf8ToBytes('{"v":1,"d":"dev","seq":1,"vv":{},"n":2}\n{}')));
    await expect(decodeSegment(gz, bytes, 0)).rejects.toThrow('1 of 2');
  });
});

describe('cutSegments', () => {
  it('packs groups up to the op cap without splitting one', () => {
    const cuts = cutSegments([group('a', 150), group('b', 40), group('c', 20)]);
    expect(cuts.map((c) => c.length)).toEqual([190, 20]);
  });

  it('puts an oversized group alone, uncapped', () => {
    const cuts = cutSegments([group('a', 5), group('b', 450), group('c', 5)]);
    expect(cuts.map((c) => c.length)).toEqual([5, 450, 5]);
    expect(cuts[1].every((o) => o.h === 'b')).toBe(true);
  });

  it('cuts on bytes', () => {
    const big = 'x'.repeat(100 * 1024);
    const cuts = cutSegments([group('a', 1, big), group('b', 1, big), group('c', 1, big)]);
    expect(cuts.map((c) => c.map((o) => o.h))).toEqual([['a', 'b'], ['c']]);
  });

  it('skips empty groups', () => {
    expect(cutSegments([[], group('a', 1), []])).toHaveLength(1);
    expect(cutSegments([])).toEqual([]);
  });
});

describe('checkpoints', () => {
  const entities: CheckpointEntity[] = [
    {
      e: 'transactions',
      id: 't1',
      exists: true,
      f: { amount_cents: { x: -500, s: '1793414025123-0000@a' }, deleted: { x: null, s: '1793414025123-0000@a' } },
      heads: { memo: [{ x: 'Lunch', s: '1793414025123-0001@a', seq: 1, vv: {} }] },
    },
    { e: 'payees', id: 'p1', exists: false, f: {}, heads: {} },
  ];

  it('round-trips header and entities', async () => {
    const bytes = await encodeCheckpoint(gz, { d: 'dev', h: '1793414025123-0005', vv: { dev: 4, b: 2 } }, entities);
    const cp = await decodeCheckpoint(gz, bytes);
    expect(cp.header).toEqual({ v: 1, d: 'dev', h: '1793414025123-0005', vv: { dev: 4, b: 2 } });
    expect(cp.entities).toEqual(entities);
  });

  it('rejects a newer protocol version', async () => {
    const bytes = new Uint8Array(gzipSync(utf8ToBytes('{"v":3,"d":"dev","h":"x","vv":{}}')));
    await expect(decodeCheckpoint(gz, bytes)).rejects.toBeInstanceOf(NewerProtocol);
  });
});
