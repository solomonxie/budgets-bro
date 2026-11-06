import { gunzipSync, gzipSync } from 'node:zlib';
import { format } from './clock';
import { decodeCheckpoint, decodeSegment, encodeCheckpoint, encodeSegment } from './codec';
import { budgetEntryGid } from './entities';
import { SyncState } from './merge';
import type { Gzip, Scalar, Segment } from './types';
import { type Vector, type VectorSegment, vectors } from './vectors';

const gz: Gzip = {
  deflate: async (b) => new Uint8Array(gzipSync(b)),
  inflate: async (b) => new Uint8Array(gunzipSync(b)),
};

// Every interleaving that keeps each device's seq order.
function interleavings<T>(byDevice: T[][]): T[][] {
  if (byDevice.every((l) => l.length === 0)) return [[]];
  const out: T[][] = [];
  byDevice.forEach((list, i) => {
    if (!list.length) return;
    const rest = byDevice.map((l, j) => (j === i ? l.slice(1) : l));
    for (const tail of interleavings(rest)) out.push([list[0]!, ...tail]);
  });
  return out;
}

const wire = async (s: VectorSegment): Promise<Segment> =>
  decodeSegment(gz, await encodeSegment(gz, s.d, s.seq, s.vv, s.ops), s.lastModified);

type Store = Record<string, Record<string, Scalar>>;

const drain = (s: SyncState, store: Store) => {
  for (const c of s.changes()) {
    const key = `${c.e}/${c.id}`;
    if (c.row) store[key] = c.row;
    else delete store[key];
  }
};

function snapshot(s: SyncState, store: Store) {
  const entities: Vector['expect']['entities'] = {};
  for (const ent of s.listed()) {
    entities[`${ent.e}/${ent.id}`] = { fields: Object.fromEntries([...ent.fields].map(([f, v]) => [f, v.x])) };
  }
  const aliases = s.aliases();
  const hidden = s.hidden();
  return {
    entities,
    conflicts: s.conflicts().map(({ e, id, f, x, d }) => ({ e, id, f, x, d })),
    ...(Object.keys(aliases).length ? { aliases } : {}),
    ...(hidden.length ? { hidden } : {}),
    store: { ...store },
  };
}

// One segment at a time, each also repeated, plus a stale repeat of the one
// before, draining changes() into a store as an applier would.
function run(order: Segment[]) {
  const s = new SyncState();
  const store: Store = {};
  order.forEach((seg, i) => {
    s.applySegment(seg);
    s.applySegment(seg);
    if (i > 0) s.applySegment(order[i - 1]!);
    drain(s, store);
  });
  return snapshot(s, store);
}

async function fromCheckpoint(prefix: Segment[], tail: Segment[]) {
  const a = new SyncState();
  for (const seg of prefix) a.applySegment(seg);
  const bytes = await encodeCheckpoint(gz, a.checkpointHeader('cp', format(a.seen)), a.checkpointEntities());
  const cp = await decodeCheckpoint(gz, bytes);
  const s = SyncState.fromCheckpoint(cp.header, cp.entities);
  const store: Store = {};
  drain(s, store);
  for (const seg of tail) {
    s.applySegment(seg);
    drain(s, store);
  }
  return snapshot(s, store);
}

describe.each(vectors.map((v) => [v.name, v] as const))('vector %s', (_name, vec) => {
  let segments: Segment[];
  let byDevice: Segment[][];

  beforeAll(async () => {
    segments = await Promise.all(vec.segments.map(wire));
    const devices = [...new Set(segments.map((s) => s.d))];
    byDevice = devices.map((d) => segments.filter((s) => s.d === d).sort((a, b) => a.seq - b.seq));
  });

  it('every interleaving equals expect', () => {
    const { rows, ...expected } = vec.expect;
    const runs = interleavings(byDevice).map(run);
    for (const r of runs) {
      const { store, ...state } = r;
      expect(state).toEqual(expected);
      expect(store).toEqual(runs[0]!.store);
      for (const [key, row] of Object.entries(rows ?? {})) expect(store[key] ?? null).toEqual(row);
    }
  });

  it('a fresh state materialises the same store', () => {
    const s = new SyncState();
    for (const seg of interleavings(byDevice)[0]!) s.applySegment(seg);
    const store: Store = {};
    drain(s, store);
    expect(store).toEqual(run(interleavings(byDevice)[0]!).store);
  });

  it('checkpoint at any point + the tail equals the whole log', async () => {
    const order = interleavings(byDevice)[0]!;
    const whole = run(order);
    for (let k = 0; k <= order.length; k++) {
      expect(await fromCheckpoint(order.slice(0, k), order.slice(k))).toEqual(whole);
    }
  });

  it('budget entry gids are derived from category + month', () => {
    for (const [key, { fields }] of Object.entries(vec.expect.entities)) {
      if (!key.startsWith('budget_entries/')) continue;
      expect(key.slice('budget_entries/'.length)).toBe(budgetEntryGid(fields.category_id as string, fields.month as string));
    }
  });
});
