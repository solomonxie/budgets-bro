import { format } from '../clock';
import { decodeCheckpoint, decodeSegment, encodeCheckpoint, encodeSegment } from '../codec';
import { budgetEntryGid } from '../entities';
import { SyncState } from '../merge';
import type { Gzip, Scalar, Segment } from '../types';
import type { Vector, VectorSegment } from '.';

// The vector runner, shared by the app's jest and the extension's vitest so
// both check the same merge the same way. No test globals here.

// Every interleaving that keeps each device's seq order.
export function interleavings<T>(byDevice: T[][]): T[][] {
  if (byDevice.every((l) => l.length === 0)) return [[]];
  const out: T[][] = [];
  byDevice.forEach((list, i) => {
    if (!list.length) return;
    const rest = byDevice.map((l, j) => (j === i ? l.slice(1) : l));
    for (const tail of interleavings(rest)) out.push([list[0]!, ...tail]);
  });
  return out;
}

export const wire = async (gz: Gzip, s: VectorSegment): Promise<Segment> =>
  decodeSegment(gz, await encodeSegment(gz, s.d, s.seq, s.vv, s.ops), s.lastModified);

export type Store = Record<string, Record<string, Scalar>>;

export const drain = (s: SyncState, store: Store) => {
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
export function run(order: Segment[]) {
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

export async function fromCheckpoint(gz: Gzip, prefix: Segment[], tail: Segment[]) {
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


export function budgetGidMismatches(vec: Vector): string[] {
  return Object.entries(vec.expect.entities)
    .filter(([key]) => key.startsWith('budget_entries/'))
    .filter(([key, { fields }]) => key.slice('budget_entries/'.length) !== budgetEntryGid(fields.category_id as string, fields.month as string))
    .map(([key]) => key);
}
