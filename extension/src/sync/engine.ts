import { BucketError, type Bucket } from '../../../sync-core/bucket';
import { utf8ToBytes } from '../../../sync-core/bytes';
import { Clock, format, parse, tooFarAhead, zero } from '../../../sync-core/clock';
import { checkpointDue, checkpointPublisher, newestCheckpointHlc } from '../../../sync-core/checkpointPolicy';
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
} from '../../../sync-core/codec';
import { syncedColumns } from '../../../sync-core/columns';
import { budgetEntryGid } from '../../../sync-core/entities';
import { type Change, type Conflict, SyncState } from '../../../sync-core/merge';
import {
  type CheckpointHeader,
  type Group,
  type Gzip,
  NewerProtocol,
  type Scalar,
  type VersionVector,
  type WireOp,
} from '../../../sync-core/types';
import type { Fatal, Sealed, Store } from '../store/store';
import { streamGzip } from './gzip';

// The browser's half of PROTOCOL.md: load the newest checkpoint plus the log
// after it, merge pulls, record local edits as one-tick groups, seal before
// applying anything pulled, and PUT segments write-once.

export interface SyncStatus {
  ready: boolean; // merge state loaded; edits allowed unless readOnly
  waiting: boolean; // no checkpoint in the bucket yet
  syncing: boolean;
  lastSynced: number | null; // bucket ms
  pending: number; // local groups not yet sealed, plus sealed segments not yet sent
  offline: boolean;
  fatal: Fatal | null;
  readOnly: boolean;
  conflicts: Conflict[];
}

export interface EngineDeps {
  store: Store;
  bucket: Bucket;
  // Shared with the bucket's onDate, so ticks are in bucket time.
  clock?: Clock;
  gzip?: Gzip;
  deviceName?: string;
  newId?: () => string;
}

export interface GroupBuilder {
  // Returns the new row's gid.
  create(e: string, fields: Record<string, Scalar>): string;
  edit(e: string, id: string, fields: Record<string, Scalar>): void;
  remove(e: string, id: string): void;
}

export class NotLoaded extends Error {}
export class ReadOnly extends Error {}

const DAY_MS = 86_400_000;
const SEGMENTS_PER_WRITE = 50;

const othersOnly = (vv: VersionVector, device: string): VersionVector => {
  const { [device]: _own, ...rest } = vv;
  return rest;
};

const keysOf = (changes: Change[]) => changes.map((c) => `${c.e}/${c.id}`);

interface Pending {
  add?: Record<string, Scalar>;
  sets: Map<string, Scalar>;
}

export class SyncEngine {
  status: SyncStatus = {
    ready: false,
    waiting: false,
    syncing: false,
    lastSynced: null,
    pending: 0,
    offline: false,
    fatal: null,
    readOnly: false,
    conflicts: [],
  };
  // Set by the triggers: called after every local edit.
  onEdit: () => void = () => {};

  private state: SyncState | null = null;
  private readonly store: Store;
  private readonly bucket: Bucket;
  private readonly clock: Clock;
  private readonly gz: Gzip;
  private readonly deviceName: string;
  private device = '';
  private nextSeq = 1;
  private unsealed = 0;
  private sealedCount = 0;
  // Store writes run one at a time, in call order.
  private queue: Promise<unknown> = Promise.resolve();
  private running: Promise<void> | null = null;
  private listeners = new Set<(s: SyncStatus) => void>();

  private constructor(deps: EngineDeps) {
    this.store = deps.store;
    this.bucket = deps.bucket;
    this.clock = deps.clock ?? new Clock();
    this.gz = deps.gzip ?? streamGzip;
    this.deviceName = deps.deviceName ?? 'Chrome';
  }

  static async open(deps: EngineDeps): Promise<SyncEngine> {
    const e = new SyncEngine(deps);
    const { store } = e;
    let device = await store.getMeta('device');
    if (!device) {
      device = (deps.newId ?? (() => crypto.randomUUID()))();
      await store.setMeta({ device });
    }
    e.device = device;
    const hlc = await store.getMeta('hlc');
    e.clock.last = hlc ? parse(hlc) : zero;
    e.clock.offset = (await store.getMeta('offset')) ?? e.clock.offset;
    e.nextSeq = (await store.getMeta('nextSeq')) ?? 1;
    e.unsealed = (await store.outbox()).length;
    e.sealedCount = (await store.sealed()).length;
    e.setFatalStatus((await store.getMeta('fatal')) ?? null);
    await e.loadLocal();
    e.refresh();
    return e;
  }

  get deviceId(): string {
    return this.device;
  }

  subscribe(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  // ── local edits ───────────────────────────────────────────────────────

  create(e: string, fields: Record<string, Scalar>): Promise<string> {
    let id = '';
    return this.group((g) => (id = g.create(e, fields))).then(() => id);
  }

  edit(e: string, id: string, fields: Record<string, Scalar>): Promise<void> {
    return this.group((g) => g.edit(e, id, fields));
  }

  remove(e: string, id: string): Promise<void> {
    return this.group((g) => g.remove(e, id));
  }

  // One local transaction, e.g. both legs of a transfer: one tick, one group.
  // Rows change in memory at once; the returned promise is the store commit.
  group(fn: (g: GroupBuilder) => void): Promise<void> {
    const state = this.state;
    if (!state) return Promise.reject(new NotLoaded('sync state not loaded'));
    if (this.status.readOnly) return Promise.reject(new ReadOnly(this.status.fatal?.kind ?? 'read-only'));

    const pending = new Map<string, Pending>();
    const entry = (e: string, id: string) => {
      const k = `${e}\u0000${id}`;
      let p = pending.get(k);
      if (!p) pending.set(k, (p = { sets: new Map() }));
      return p;
    };
    const check = (e: string, fields: Record<string, Scalar>) => {
      const allowed = syncedColumns[e];
      if (!allowed) throw new Error(`not a synced table: ${e}`);
      for (const f of Object.keys(fields)) if (!allowed.includes(f)) throw new Error(`not a synced field: ${e}.${f}`);
    };
    const deletes: [string, string][] = [];
    fn({
      create: (e, fields) => {
        check(e, fields);
        const id =
          e === 'budget_entries'
            ? budgetEntryGid(String(fields.category_id), String(fields.month))
            : crypto.randomUUID();
        const x: Record<string, Scalar> = {};
        for (const f of syncedColumns[e]!) x[f] = null;
        entry(e, id).add = { ...x, ...fields, deleted: null };
        return id;
      },
      edit: (e, id, fields) => {
        check(e, fields);
        const p = entry(e, id);
        for (const [f, v] of Object.entries(fields)) p.sets.set(f, v);
      },
      remove: (e, id) => {
        if (!syncedColumns[e]) throw new Error(`not a synced table: ${e}`);
        deletes.push([e, id]);
      },
    });

    this.clock.receive(state.seen);
    const hlc = this.clock.tick();
    const h = format(hlc);
    for (const [e, id] of deletes) entry(e, id).sets.set('deleted', hlc.wall);

    const ops: Group = [];
    for (const [k, p] of pending) {
      const [e, id] = k.split('\u0000') as [string, string];
      if (p.add) ops.push({ h, e, id, o: 'add', x: { ...p.add, ...Object.fromEntries(p.sets) } });
      else for (const [f, x] of p.sets) ops.push({ h, e, id, o: 'set', f, x });
    }
    if (ops.length === 0) return Promise.resolve();

    const vv = othersOnly(state.vv, this.device);
    for (const op of ops) state.apply({ ...op, d: this.device, seq: this.nextSeq, vv });
    const changes = state.changes();
    const lines = state.lines(keysOf(changes));
    const header = this.header();
    this.unsealed++;
    this.refresh();
    this.onEdit();
    return this.enqueue(() => this.store.commitLocal(changes, ops, { hlc: h, stateHeader: header }, lines)).then(
      () => undefined,
      async (error) => {
        // The op is in memory but not in the outbox: rebuild from the store.
        this.unsealed--;
        await this.loadLocal();
        this.refresh();
        throw error;
      },
    );
  }

  // ── sync ──────────────────────────────────────────────────────────────

  // One run at a time; a trigger mid-run joins it.
  sync(): Promise<void> {
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  // Seal and send only: for a page being hidden, where a pull isn't worth it.
  async flush(): Promise<void> {
    if (!this.state || this.status.readOnly) return;
    await this.guard(() => this.push());
  }

  private async run(): Promise<void> {
    this.status.syncing = true;
    this.emit();
    if (this.status.fatal?.kind === 'auth') await this.setFatal(null);
    const ok = await this.guard(async () => {
      if (!this.state && !(await this.loadCheckpoint())) {
        this.status.waiting = true;
        return;
      }
      this.status.waiting = false;
      if (!this.status.readOnly) await this.push();
      await this.pull();
      if (!this.status.readOnly && this.unsealed + this.sealedCount > 0) await this.push();
      await this.maybePublishCheckpoint();
    });
    if (ok) this.status.lastSynced = this.clock.bucketNow();
    await this.enqueue(() => this.store.setMeta({ offset: this.clock.offset, hlc: format(this.clock.last) }));
    this.status.syncing = false;
    this.refresh();
  }

  private async guard(body: () => Promise<void>): Promise<boolean> {
    try {
      await body();
      this.status.offline = false;
      return true;
    } catch (error) {
      if (error instanceof BucketError && (error.status === 401 || error.status === 403)) {
        await this.setFatal({ kind: 'auth', detail: error.message, at: this.clock.bucketNow() });
      } else if (error instanceof TypeError) {
        this.status.offline = true;
      } else if (error instanceof NewerProtocol) {
        await this.setFatal({ kind: 'newer', detail: `v${error.v}`, at: this.clock.bucketNow() });
      } else {
        throw error;
      }
      return false;
    }
  }

  // Persisted state from an earlier session: no download.
  private async loadLocal(): Promise<void> {
    const { header, lines } = await this.store.loadState();
    if (!header) {
      this.state = null;
      return;
    }
    const state = SyncState.fromCheckpoint(header, lines);
    state.changes(); // rows already reflect it
    this.state = state;
    this.clock.receive(state.seen);
  }

  // First open: the newest checkpoint by hlc, across devices.
  private async loadCheckpoint(): Promise<boolean> {
    let best: { key: string; h: string } | null = null;
    for (const o of await this.bucket.list('sync/checkpoints/')) {
      const h = hlcOfCheckpointKey(o.key);
      if (h && (!best || h > best.h)) best = { key: o.key, h };
    }
    if (!best) return false;
    const bytes = await this.bucket.get(best.key);
    if (!bytes) return false;
    const cp = await decodeCheckpoint(this.gz, bytes);
    const state = SyncState.fromCheckpoint(cp.header, cp.entities);
    const changes = state.changes();
    this.state = state;
    this.clock.receive(state.seen);
    await this.enqueue(() => this.store.applyPulled(changes, [...state.checkpointEntities()], { stateHeader: this.header() }));
    return true;
  }

  // Each other device's segments after what we hold, in seq order; a gap,
  // a newer version or a far-future clock stops that device only.
  async pull(): Promise<number> {
    const state = this.state;
    if (!state) return 0;
    let applied = 0;
    let batch = 0;
    for (const d of await this.devices()) {
      const have0 = state.vv[d] ?? 0;
      const listed = await this.bucket.list(`sync/log/${d}/`, have0 ? { startAfter: segmentKey(d, have0) } : {});
      const sources = listed
        .map((o) => ({ ...o, seq: seqOf(o.key) }))
        .filter((o): o is typeof o & { seq: number } => o.seq !== null)
        .sort((a, b) => a.seq - b.seq);
      for (const src of sources) {
        const have = state.vv[d] ?? 0;
        if (src.seq <= have) continue;
        if (src.seq !== have + 1) break;
        const bytes = await this.bucket.get(src.key);
        if (!bytes) break;
        let segment;
        try {
          segment = await decodeSegment(this.gz, bytes, src.lastModified);
        } catch (error) {
          if (!(error instanceof NewerProtocol)) throw error;
          await this.setFatal({ kind: 'newer', detail: `${d}/${src.seq} v${error.v}`, at: this.clock.bucketNow() });
          break;
        }
        const ahead = segment.ops.find((op) => tooFarAhead(parse(op.h), this.clock.bucketNow()));
        if (ahead) {
          await this.setFatal({ kind: 'clock', detail: `${d}/${src.seq} ${ahead.h}`, at: this.clock.bucketNow() });
          break;
        }
        // Seal before apply: every local op is sealed under the vv it was made with.
        while (this.unsealed > 0) await this.seal();
        state.applySegment(segment);
        applied += segment.ops.length;
        if (++batch >= SEGMENTS_PER_WRITE) {
          await this.writePulled();
          batch = 0;
        }
      }
    }
    await this.writePulled();
    this.clock.receive(state.seen);
    this.refresh();
    return applied;
  }

  private async writePulled(): Promise<void> {
    const state = this.state!;
    const changes = state.changes();
    const lines = state.lines(keysOf(changes));
    const header = this.header();
    await this.enqueue(() => this.store.applyPulled(changes, lines, { stateHeader: header }));
  }

  private async devices(): Promise<string[]> {
    const listed = await this.bucket.list('sync/devices/');
    const ids = listed.map((o) => /^sync\/devices\/([^/]+)\.json$/.exec(o.key)?.[1]).filter((x): x is string => !!x);
    return [...new Set([...Object.keys(this.state!.vv), ...ids])].filter((d) => d !== this.device).sort();
  }

  // Outbox groups → segments. Own segments are merged here, so the local
  // copies of their ops learn their real seq and the own vv moves on.
  private seal(): Promise<void> {
    return this.enqueue(async () => {
      const entries = await this.store.outbox();
      if (entries.length === 0) return;
      const state = this.state!;
      const vv = othersOnly(state.vv, this.device);
      let seq = this.nextSeq;
      const sealed: Sealed[] = [];
      for (const ops of cutSegments(entries.map((x) => x.group))) {
        sealed.push({ seq, key: segmentKey(this.device, seq), bytes: await encodeSegment(this.gz, this.device, seq, vv, ops) });
        const merged = state.applySegment({
          d: this.device,
          seq,
          vv,
          ops: ops.map((op: WireOp) => ({ ...op, d: this.device, seq, vv })),
          lastModified: this.clock.bucketNow(),
        });
        if (!merged) throw new Error(`own segment ${seq} out of order (vv ${state.vv[this.device] ?? 0})`);
        seq++;
      }
      const changes = state.changes();
      await this.store.seal(
        entries.map((x) => x.id),
        sealed,
        { nextSeq: seq, stateHeader: this.header() },
        changes,
        state.lines(keysOf(changes)),
      );
      this.nextSeq = seq;
      this.unsealed -= entries.length;
      this.sealedCount += sealed.length;
    });
  }

  private async push(): Promise<void> {
    while (this.unsealed > 0) await this.seal();
    const sealed = (await this.store.sealed()).sort((a, b) => a.seq - b.seq);
    if (sealed.length === 0 || this.status.readOnly) return;
    if (!(await this.announceDevice())) return;
    for (const s of sealed) {
      if ((await this.bucket.putOnce(s.key, s.bytes)) === 'collision') {
        await this.setFatal({ kind: 'collision', detail: s.key, at: this.clock.bucketNow() });
        return;
      }
      await this.enqueue(() => this.store.markSent(s.seq));
      this.sealedCount--;
      this.refresh();
    }
  }

  // Own prefix empty before the first write; device file refreshed daily.
  private async announceDevice(): Promise<boolean> {
    const now = this.clock.bucketNow();
    const created = await this.store.getMeta('deviceCreated');
    if (created === undefined) {
      if ((await this.bucket.list(`sync/log/${this.device}/`, { max: 1 })).length > 0) {
        await this.setFatal({ kind: 'collision', detail: `sync/log/${this.device}/ is not empty`, at: now });
        return false;
      }
    } else if (now - ((await this.store.getMeta('deviceSeen')) ?? 0) < DAY_MS) {
      return true;
    }
    const file = { device: this.device, name: this.deviceName, kind: 'browser', created: created ?? now, lastSeen: now };
    await this.bucket.put(`sync/devices/${this.device}.json`, utf8ToBytes(JSON.stringify(file)), 'application/json');
    await this.enqueue(() => this.store.setMeta({ deviceCreated: created ?? now, deviceSeen: now }));
    return true;
  }

  // At most daily, by whichever device the shared rule picks
  // (sync-core/checkpointPolicy.ts). One list when not due.
  private async maybePublishCheckpoint(): Promise<void> {
    const state = this.state;
    if (!state || this.status.readOnly || this.sealedCount > 0) return;
    const newest = newestCheckpointHlc((await this.bucket.list('sync/checkpoints/')).map((o) => o.key));
    if (!checkpointDue(newest, this.clock.bucketNow())) return;
    const lines = [...state.checkpointEntities()].sort((a, b) => (`${a.e}/${a.id}` < `${b.e}/${b.id}` ? -1 : 1));
    if (checkpointPublisher(lines, newest) !== this.device) return;
    const h = format(state.seen);
    const bytes = await encodeCheckpoint(this.gz, { d: this.device, h, vv: { ...state.vv } }, lines);
    // Same key, other bytes: someone published this exact moment; theirs stands.
    await this.bucket.putOnce(checkpointKey(this.device, h), bytes);
  }

  // ── helpers ───────────────────────────────────────────────────────────

  private header(): CheckpointHeader {
    return this.state!.checkpointHeader(this.device, format(this.state!.seen));
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  private setFatalStatus(fatal: Fatal | null): void {
    this.status.fatal = fatal;
    this.status.readOnly = fatal !== null;
  }

  private async setFatal(fatal: Fatal | null): Promise<void> {
    this.setFatalStatus(fatal);
    await this.enqueue(() => this.store.setMeta({ fatal }));
    this.emit();
  }

  private refresh(): void {
    this.status.ready = this.state !== null;
    this.status.pending = this.unsealed + this.sealedCount;
    this.status.conflicts = this.state?.conflicts() ?? [];
    this.emit();
  }

  private emit(): void {
    const snapshot = { ...this.status };
    for (const fn of this.listeners) fn(snapshot);
  }
}
