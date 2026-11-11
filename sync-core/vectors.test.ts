import { gunzipSync, gzipSync } from 'node:zlib';
import { SyncState } from './merge';
import type { Gzip, Segment } from './types';
import { vectors } from './vectors';
import { budgetGidMismatches, drain, fromCheckpoint, interleavings, run, type Store, wire } from './vectors/runner';

const gz: Gzip = {
  deflate: async (b) => new Uint8Array(gzipSync(b)),
  inflate: async (b) => new Uint8Array(gunzipSync(b)),
};

describe.each(vectors.map((v) => [v.name, v] as const))('vector %s', (_name, vec) => {
  let byDevice: Segment[][];

  beforeAll(async () => {
    const segments = await Promise.all(vec.segments.map((s) => wire(gz, s)));
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
      expect(await fromCheckpoint(gz, order.slice(0, k), order.slice(k))).toEqual(whole);
    }
  });

  it('budget entry gids are derived from category + month', () => {
    expect(budgetGidMismatches(vec)).toEqual([]);
  });
});
