import { type Hlc, beyondSegment, parse, receive, zero } from './clock';
import { entities, isTextField, naturalKeys } from './entities';
import {
  type CheckpointEntity,
  type CheckpointHeader,
  type FieldValue,
  type Op,
  type Scalar,
  type Segment,
  type VersionVector,
  NewerProtocol,
  protocolVersion,
  stampOf,
} from './types';

export interface EntityState {
  e: string;
  id: string;
  exists: boolean;
  fields: Map<string, FieldValue>;
  // Per text field, the ops no other op on that field has seen.
  heads: Map<string, Op[]>;
}

export interface Conflict {
  e: string;
  id: string;
  f: string;
  x: Scalar;
  d: string;
  s: string;
}

// What a local store should hold for an entity. Only `live` has a row.
export type Status = 'absent' | 'deleted' | 'alias' | 'parked' | 'hidden' | 'live';

export interface Change {
  e: string;
  id: string;
  status: Status;
  // Synced fields with FKs resolved to the gid to store (alias → canonical,
  // dead nullable target → null); no `deleted`. Null unless `live`.
  row: Record<string, Scalar> | null;
}

const severity: Record<Status, number> = { live: 0, hidden: 1, parked: 2, absent: 2, deleted: 2, alias: 2 };

export const saw = (a: Op, b: Op): boolean =>
  a.d === b.d ? stampOf(a) > stampOf(b) : (a.vv[b.d] ?? 0) >= b.seq;

const keyOf = (e: string, id: string) => `${e}/${id}`;
const splitKey = (key: string): [string, string] => {
  const slash = key.indexOf('/');
  return [key.slice(0, slash), key.slice(slash + 1)];
};

// The merged ledger: same state from the same ops in any order. Ported from
// Photos Vault's extension/src/sync/merge.ts, plus the BB materialisation
// rules (natural-key aliases, parked and dead references).
export class SyncState {
  entities = new Map<string, EntityState>();
  vv: VersionVector = {};
  seen: Hlc = zero;

  private touched = new Set<string>();
  // Superset of who references whom; stale entries only cost a recompute.
  private referrers = new Map<string, Set<string>>();
  private groupOf = new Map<string, string>();
  private groups = new Map<string, Set<string>>();
  private status = new Map<string, Status>();
  private fkSig = new Map<string, string>();

  entity(e: string, id: string): EntityState {
    const key = keyOf(e, id);
    this.touched.add(key);
    let ent = this.entities.get(key);
    if (!ent) {
      ent = { e, id, exists: false, fields: new Map(), heads: new Map() };
      this.entities.set(key, ent);
    }
    return ent;
  }

  // Applies `s` if it is the device's next; false on a gap or a repeat.
  applySegment(s: Segment): boolean {
    if (s.seq !== (this.vv[s.d] ?? 0) + 1) return false;
    for (const op of s.ops) if (!beyondSegment(parse(op.h), s.lastModified)) this.apply(op);
    this.vv[s.d] = s.seq;
    return true;
  }

  // Also the entry for an unsealed local op: seq = next seq, vv = current vv.
  apply(op: Op): void {
    this.seen = receive(this.seen, parse(op.h));
    const ent = this.entity(op.e, op.id);
    if (op.o === 'add') {
      ent.exists = true;
      const x = (op.x ?? {}) as Record<string, Scalar>;
      for (const f of Object.keys(x)) this.setField(ent, f, x[f] ?? null, op);
    } else {
      this.setField(ent, op.f!, (op.x ?? null) as Scalar, op);
    }
    this.index(ent);
  }

  private setField(ent: EntityState, f: string, x: Scalar, op: Op): void {
    const s = stampOf(op);
    const cur = ent.fields.get(f);
    if (!cur || s > cur.s) ent.fields.set(f, { x, s });
    if (!isTextField(ent.e, f)) return;
    const asField: Op = op.o === 'set' ? op : { ...op, o: 'set', f, x };
    const heads = ent.heads.get(f) ?? [];
    if (heads.some((h) => stampOf(h) === s || saw(h, asField))) return;
    ent.heads.set(f, [...heads.filter((h) => !saw(asField, h)), asField]);
  }

  private index(ent: EntityState): void {
    const key = keyOf(ent.e, ent.id);
    const fks = entities[ent.e]?.fks ?? {};
    for (const f of Object.keys(fks)) {
      const target = ent.fields.get(f)?.x;
      if (typeof target !== 'string') continue;
      const tkey = keyOf(fks[f]!.to, target);
      let set = this.referrers.get(tkey);
      if (!set) this.referrers.set(tkey, (set = new Set()));
      set.add(key);
    }
    const nk = naturalKeys[ent.e];
    if (!nk) return;
    const values = nk.map((f) => ent.fields.get(f)?.x ?? null);
    const live = ent.exists && ent.fields.get('deleted')?.x == null && values.every((v) => v !== null);
    const group = live ? `${ent.e}\u0000${JSON.stringify(values)}` : null;
    const old = this.groupOf.get(key);
    if (old === group) return;
    if (old !== undefined) {
      const members = this.groups.get(old)!;
      members.delete(key);
      for (const m of members) this.touched.add(m);
      if (members.size === 0) this.groups.delete(old);
      this.groupOf.delete(key);
    }
    if (group !== null) {
      let members = this.groups.get(group);
      if (!members) this.groups.set(group, (members = new Set()));
      for (const m of members) this.touched.add(m);
      members.add(key);
      this.groupOf.set(key, group);
    }
  }

  *listed(): Iterable<EntityState> {
    for (const ent of this.entities.values()) if (ent.exists) yield ent;
  }

  conflicts(): Conflict[] {
    const out: Conflict[] = [];
    for (const ent of this.listed()) {
      for (const [f, heads] of ent.heads) {
        const winner = ent.fields.get(f)!.s;
        for (const h of heads) {
          const s = stampOf(h);
          if (s !== winner) out.push({ e: ent.e, id: ent.id, f, x: (h.x ?? null) as Scalar, d: h.d, s });
        }
      }
    }
    const key = (c: Conflict) => [c.e, c.id, c.f, c.s];
    return out.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i]! < kb[i]! ? -1 : 1;
      return 0;
    });
  }

  // The canonical key an alias stands for, or the key itself.
  canonical(key: string): string {
    const group = this.groupOf.get(key);
    if (group === undefined) return key;
    let min = key;
    for (const m of this.groups.get(group)!) if (m < min) min = m;
    return min;
  }

  // Entities whose stored row may differ since the last call, then forgets
  // them: an applier writes exactly these, nothing else.
  changes(): Change[] {
    const out = [...this.settle()].map((key) => {
      const [e, id] = splitKey(key);
      const status = this.status.get(key)!;
      return { e, id, status, row: status === 'live' ? this.row(key) : null };
    });
    this.unsent.clear();
    return out.sort((a, b) => (keyOf(a.e, a.id) < keyOf(b.e, b.id) ? -1 : 1));
  }

  // Brings statuses up to date; returns every key not yet handed out.
  private settle(): Set<string> {
    const touched = new Set(this.touched);
    this.touched.clear();
    const affected = new Set<string>();
    const queue = [...touched];
    while (queue.length) {
      const key = queue.pop()!;
      if (affected.has(key)) continue;
      affected.add(key);
      for (const r of this.referrers.get(key) ?? []) queue.push(r);
      const group = this.groupOf.get(key);
      if (group !== undefined) for (const m of this.groups.get(group)!) queue.push(m);
    }
    const before = new Map<string, Status | undefined>();
    for (const key of affected) {
      before.set(key, this.status.get(key));
      this.status.set(key, this.baseStatus(key));
    }
    // Greatest fixpoint: start every candidate at its best and only demote,
    // so the result is the same whichever cycle member is visited first.
    for (let changed = true; changed; ) {
      changed = false;
      for (const key of affected) {
        const cur = this.status.get(key)!;
        if (cur !== 'live' && cur !== 'hidden') continue;
        const next = this.refStatus(key);
        if (severity[next] > severity[cur]) {
          this.status.set(key, next);
          changed = true;
        }
      }
    }
    for (const key of affected) {
      const status = this.status.get(key)!;
      const sig = status === 'live' ? this.sig(key) : '';
      if (touched.has(key) || before.get(key) !== status || this.fkSig.get(key) !== sig) this.unsent.add(key);
      this.fkSig.set(key, sig);
    }
    return this.unsent;
  }

  private unsent = new Set<string>();

  private baseStatus(key: string): Status {
    const ent = this.entities.get(key);
    if (!ent?.exists) return 'absent';
    if (ent.fields.get('deleted')?.x != null) return 'deleted';
    if (this.canonical(key) !== key) return 'alias';
    return 'live';
  }

  private target(e: string, f: string, ent: EntityState): string | null {
    const gid = ent.fields.get(f)?.x;
    if (typeof gid !== 'string') return null;
    return this.canonical(keyOf(entities[e]!.fks[f]!.to, gid));
  }

  private statusOf(key: string): Status {
    return this.status.get(key) ?? this.baseStatus(key);
  }

  private refStatus(key: string): Status {
    const ent = this.entities.get(key)!;
    const fks = entities[ent.e]?.fks ?? {};
    let worst: Status = 'live';
    for (const f of Object.keys(fks)) {
      const t = this.target(ent.e, f, ent);
      if (t === null) continue;
      const ts = this.statusOf(t);
      let mine: Status = 'live';
      if (ts === 'absent' || ts === 'parked') mine = 'parked';
      else if ((ts === 'deleted' || ts === 'hidden') && !fks[f]!.nullable) mine = 'hidden';
      if (severity[mine] > severity[worst]) worst = mine;
    }
    return worst;
  }

  private row(key: string): Record<string, Scalar> {
    const ent = this.entities.get(key)!;
    const fks = entities[ent.e]?.fks ?? {};
    const row: Record<string, Scalar> = {};
    for (const [f, v] of ent.fields) {
      if (f === 'deleted') continue;
      if (!fks[f]) {
        row[f] = v.x;
        continue;
      }
      const t = this.target(ent.e, f, ent);
      row[f] = t !== null && this.statusOf(t) === 'live' ? splitKey(t)[1] : null;
    }
    return row;
  }

  private sig(key: string): string {
    const ent = this.entities.get(key)!;
    const fks = entities[ent.e]?.fks ?? {};
    return Object.keys(fks)
      .map((f) => {
        const t = this.target(ent.e, f, ent);
        return t !== null && this.statusOf(t) === 'live' ? t : '';
      })
      .join('|');
  }

  aliases(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of [...this.groupOf.keys()].sort()) {
      const c = this.canonical(key);
      if (c !== key) out[key] = c;
    }
    return out;
  }

  hidden(): string[] {
    this.settle();
    return [...this.status]
      .filter(([key, s]) => (s === 'parked' || s === 'hidden') && this.entities.get(key)?.exists)
      .map(([key]) => key)
      .sort();
  }

  checkpointHeader(d: string, h: string): CheckpointHeader {
    return { v: protocolVersion, d, h, vv: { ...this.vv } };
  }

  *checkpointEntities(): Iterable<CheckpointEntity> {
    for (const ent of this.entities.values()) {
      yield {
        e: ent.e,
        id: ent.id,
        exists: ent.exists,
        f: Object.fromEntries([...ent.fields].map(([f, v]) => [f, { x: v.x, s: v.s }])),
        heads: Object.fromEntries(
          [...ent.heads].map(([f, ops]) => [
            f,
            ops.map((op) => ({ x: (op.x ?? null) as Scalar, s: stampOf(op), seq: op.seq, vv: op.vv })),
          ]),
        ),
      };
    }
  }

  static fromCheckpoint(header: CheckpointHeader, lines: Iterable<CheckpointEntity>): SyncState {
    if (header.v > protocolVersion) throw new NewerProtocol(header.v);
    const s = new SyncState();
    s.vv = { ...header.vv };
    for (const j of lines) {
      const ent = s.entity(j.e, j.id);
      ent.exists = j.exists;
      for (const [f, v] of Object.entries(j.f)) {
        ent.fields.set(f, { x: v.x, s: v.s });
        s.seen = receive(s.seen, parse(v.s.slice(0, v.s.indexOf('@'))));
      }
      for (const [f, heads] of Object.entries(j.heads)) {
        ent.heads.set(
          f,
          heads.map((h) => {
            const at = h.s.indexOf('@');
            return { h: h.s.slice(0, at), d: h.s.slice(at + 1), seq: h.seq, vv: h.vv, e: j.e, id: j.id, o: 'set' as const, f, x: h.x };
          }),
        );
      }
      s.index(ent);
    }
    return s;
  }
}
