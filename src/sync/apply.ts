import type { SQLiteDatabase, SQLParam } from '../db/driver';
import * as syncState from '../db/repositories/syncStateRepo';
import type { Bucket, ListedObject } from '../../sync-core/bucket';
import { decodeSegment, seqOf } from '../../sync-core/codec';
import { compare, format, parse, tooFarAhead } from '../../sync-core/clock';
import { entities } from '../../sync-core/entities';
import { type Change, SyncState } from '../../sync-core/merge';
import { type CheckpointEntity, type Gzip, NewerProtocol, type Scalar, type Segment } from '../../sync-core/types';

// Pulls every device's new segments, merges them, and writes what changed
// into the ledger. PROTOCOL.md "Pull".
//
// Precondition: the caller has sealed the outbox (every local change_log row
// is in a sealed segment) before calling. Own sealed segments are merged here
// first, so a remote op can never overwrite a newer local edit.

export interface PullDeps {
  db: SQLiteDatabase;
  bucket: Bucket;
  gzip: Gzip;
  device: string;
  // Bucket time, ms.
  now: () => number;
}

export interface PullResult {
  applied: number;
  stopped: Record<string, 'gap' | 'newer' | 'clock'>;
}

// Parents before children: NOT NULL FK targets always land first.
const ORDER = [
  'boards',
  'category_groups',
  'accounts',
  'categories',
  'payees',
  'scheduled_transactions',
  'transactions',
  'budget_entries',
  'custom_goals',
  'payment_decisions',
  'account_value_history',
  'account_rate_history',
  'houses',
  'house_prices',
  'community_prices',
];
const NEVER = new Set(['id', 'gid', 'updated_at']);
// Natural keys whose UNIQUE index a batch could trip mid-transaction.
const UNIQUE_TEMP: Record<string, { field: string; temp: string }> = {
  payees: { field: 'name', temp: `name || char(0) || gid` },
  transactions: { field: 'import_id', temp: 'NULL' },
};
const SEGMENTS_PER_COMMIT = 50;
const IN_CHUNK = 500;

const cache = new WeakMap<SQLiteDatabase, SyncState>();

// A restore or reset must drop the in-memory state with the tables.
export function forgetState(db: SQLiteDatabase): void {
  cache.delete(db);
}

async function loadState(db: SQLiteDatabase): Promise<SyncState> {
  const hit = cache.get(db);
  if (hit) return hit;
  const [lines, vv, hlc] = await Promise.all([
    syncState.loadEntities(db),
    syncState.getVersionVector(db),
    syncState.getMeta(db, 'hlc'),
  ]);
  const state = SyncState.fromCheckpoint({ v: 1, d: '', h: hlc ?? '', vv }, lines);
  // The ledger already reflects persisted state: settle it, write nothing.
  state.changes();
  cache.set(db, state);
  return state;
}

interface Source {
  seq: number;
  key: string;
  lastModified: number;
  bytes: () => Promise<Uint8Array | null>;
}

async function sourcesFor(deps: PullDeps, d: string, after: string | undefined): Promise<Source[]> {
  const listed: ListedObject[] = await deps.bucket.list(`sync/log/${d}/`, after ? { startAfter: after } : {});
  const out = new Map<number, Source>();
  for (const o of listed) {
    const seq = seqOf(o.key);
    if (seq !== null) out.set(seq, { seq, key: o.key, lastModified: o.lastModified, bytes: () => deps.bucket.get(o.key) });
  }
  if (d === deps.device) {
    // Not sent yet: merged from local bytes, stamped in bucket time already.
    for (const s of await syncState.listSealed(deps.db)) {
      out.set(s.seq, { seq: s.seq, key: s.key, lastModified: deps.now(), bytes: async () => s.bytes });
    }
  }
  return [...out.values()].sort((a, b) => a.seq - b.seq);
}

async function devices(deps: PullDeps, known: string[]): Promise<string[]> {
  const listed = await deps.bucket.list('sync/devices/');
  const ids = listed.map((o) => /^sync\/devices\/([^/]+)\.json$/.exec(o.key)?.[1]).filter((x): x is string => !!x);
  return [...new Set([deps.device, ...known, ...ids])].sort();
}

export async function pull(deps: PullDeps): Promise<PullResult> {
  const { db } = deps;
  const state = await loadState(db);
  const appliedBefore = await syncState.getApplied(db);
  const result: PullResult = { applied: 0, stopped: {} };
  const applied = new Map<string, syncState.Applied>();
  let pending = 0;

  const flush = async () => {
    if (pending === 0) return;
    try {
      await writeChanges(db, state, applied);
    } catch (error) {
      forgetState(db);
      throw error;
    }
    applied.clear();
    pending = 0;
  };

  for (const d of await devices(deps, Object.keys(appliedBefore))) {
    const sources = await sourcesFor(deps, d, appliedBefore[d]?.lastKey);
    for (const src of sources) {
      const have = state.vv[d] ?? 0;
      if (src.seq <= have) continue;
      if (src.seq !== have + 1) {
        result.stopped[d] = 'gap';
        break;
      }
      const bytes = await src.bytes();
      if (!bytes) {
        result.stopped[d] = 'gap';
        break;
      }
      let segment: Segment;
      try {
        segment = await decodeSegment(deps.gzip, bytes, src.lastModified);
      } catch (error) {
        if (!(error instanceof NewerProtocol)) throw error;
        result.stopped[d] = 'newer';
        await syncState.setMeta(db, 'fatal', { kind: 'newer', detail: `${d}/${src.seq} v${error.v}`, at: deps.now() });
        break;
      }
      const ahead = segment.ops.find((op) => tooFarAhead(parse(op.h), deps.now()));
      if (ahead) {
        result.stopped[d] = 'clock';
        await syncState.setMeta(db, 'fatal', { kind: 'clock', detail: `${d}/${src.seq} ${ahead.h}`, at: deps.now() });
        break;
      }
      state.applySegment(segment);
      applied.set(d, { seq: segment.seq, lastKey: src.key });
      result.applied += segment.ops.length;
      if (++pending >= SEGMENTS_PER_COMMIT) await flush();
    }
  }
  await flush();
  return result;
}

// --- writing --------------------------------------------------------------

const columnCache = new WeakMap<SQLiteDatabase, Map<string, Set<string>>>();

async function columnsOf(db: SQLiteDatabase, table: string): Promise<Set<string>> {
  let byTable = columnCache.get(db);
  if (!byTable) columnCache.set(db, (byTable = new Map()));
  let cols = byTable.get(table);
  if (!cols) {
    const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    cols = new Set(rows.map((r) => r.name).filter((c) => !NEVER.has(c)));
    byTable.set(table, cols);
  }
  return cols;
}

type Row = Record<string, Scalar> & { id: number; gid: string };

function chunks<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += IN_CHUNK) out.push(xs.slice(i, i + IN_CHUNK));
  return out;
}

async function rowsByGid(db: SQLiteDatabase, table: string, gids: string[], what: string): Promise<Map<string, Row>> {
  const out = new Map<string, Row>();
  for (const part of chunks(gids)) {
    const rows = await db.getAllAsync<Row>(
      `SELECT ${what} FROM ${table} WHERE gid IN (${part.map(() => '?').join(',')})`,
      ...part,
    );
    for (const r of rows) out.set(r.gid, r);
  }
  return out;
}

const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

async function writeChanges(db: SQLiteDatabase, state: SyncState, applied: Map<string, syncState.Applied>) {
  const all = state.changes();
  const lines = linesFor(state, all);
  const byTable = new Map<string, Change[]>();
  for (const c of all) if (ORDER.includes(c.e)) (byTable.get(c.e) ?? byTable.set(c.e, []).get(c.e)!).push(c);

  await db.withTransactionAsync(async () => {
    const before = (await db.getFirstAsync<{ s: number | null }>('SELECT max(seq) AS s FROM change_log'))?.s ?? 0;
    await db.execAsync('PRAGMA defer_foreign_keys = ON');

    // Local ids by `<table>/<gid>`, for own rows and every FK target.
    const ids = new Map<string, number>();
    const current = new Map<string, Map<string, Row>>();
    const targets = new Map<string, Set<string>>();
    for (const [table, list] of byTable) {
      const rows = await rowsByGid(db, table, list.map((c) => c.id), '*');
      current.set(table, rows);
      for (const r of rows.values()) ids.set(`${table}/${r.gid}`, r.id);
      for (const c of list) {
        if (!c.row) continue;
        for (const [f, fk] of Object.entries(entities[table]!.fks)) {
          const gid = c.row[f];
          if (typeof gid === 'string' && !ids.has(`${fk.to}/${gid}`)) {
            (targets.get(fk.to) ?? targets.set(fk.to, new Set()).get(fk.to)!).add(gid);
          }
        }
      }
    }
    for (const [table, gids] of targets) {
      const missing = [...gids].filter((g) => !ids.has(`${table}/${g}`));
      for (const r of (await rowsByGid(db, table, missing, 'id, gid')).values()) ids.set(`${table}/${r.gid}`, r.id);
    }

    // Deletes first: they free natural keys the upserts may reuse.
    for (const table of [...ORDER].reverse()) {
      const gone = (byTable.get(table) ?? [])
        .filter((c) => c.status !== 'live' && c.status !== 'absent')
        .map((c) => current.get(table)!.get(c.id)?.id)
        .filter((id): id is number => id !== undefined);
      for (const part of chunks(gone)) {
        await db.runAsync(`DELETE FROM ${table} WHERE id IN (${part.map(() => '?').join(',')})`, ...part);
      }
    }

    // Rows whose natural key moves step aside first, so a swap can't collide.
    for (const [table, { field, temp }] of Object.entries(UNIQUE_TEMP)) {
      const moving = (byTable.get(table) ?? [])
        .filter((c) => c.row && current.get(table)!.has(c.id) && !same(current.get(table)!.get(c.id)![field], c.row[field]))
        .map((c) => current.get(table)!.get(c.id)!.id);
      for (const part of chunks(moving)) {
        await db.runAsync(`UPDATE ${table} SET ${field} = ${temp} WHERE id IN (${part.map(() => '?').join(',')})`, ...part);
      }
    }

    const fixups: { table: string; id: number; f: string; to: string; gid: string }[] = [];
    for (const table of ORDER) {
      const cols = await columnsOf(db, table);
      const fks = entities[table]!.fks;
      for (const c of byTable.get(table) ?? []) {
        if (!c.row) continue;
        const values: Record<string, SQLParam> = {};
        const late: { f: string; to: string; gid: string }[] = [];
        for (const [f, x] of Object.entries(c.row)) {
          if (!cols.has(f)) continue;
          const fk = fks[f];
          if (!fk || typeof x !== 'string') {
            values[f] = x;
            continue;
          }
          const id = ids.get(`${fk.to}/${x}`);
          if (id === undefined) late.push({ f, to: fk.to, gid: x });
          values[f] = id ?? null;
        }
        const existing = current.get(table)!.get(c.id);
        let id: number;
        if (existing) {
          id = existing.id;
          const changed = Object.keys(values).filter((f) => !same(existing[f], values[f]));
          if (changed.length) {
            await db.runAsync(
              `UPDATE ${table} SET ${changed.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
              ...changed.map((f) => values[f]!),
              id,
            );
          }
        } else {
          const fields = Object.keys(values);
          const r = await db.runAsync(
            `INSERT INTO ${table} (gid${fields.map((f) => `, ${f}`).join('')}) VALUES (?${', ?'.repeat(fields.length)})`,
            c.id,
            ...fields.map((f) => values[f]!),
          );
          id = r.lastInsertRowId;
          ids.set(`${table}/${c.id}`, id);
        }
        for (const l of late) fixups.push({ table, id, ...l });
      }
    }
    // Nullable FKs whose target landed later in this batch (reference cycles).
    for (const fx of fixups) {
      const target = ids.get(`${fx.to}/${fx.gid}`);
      if (target !== undefined) await db.runAsync(`UPDATE ${fx.table} SET ${fx.f} = ? WHERE id = ?`, target, fx.id);
    }

    const after = (await db.getFirstAsync<{ s: number | null }>('SELECT max(seq) AS s FROM change_log'))?.s ?? 0;
    await syncState.addRemoteRange(db, { lo: before + 1, hi: after });
    await syncState.saveEntities(db, lines);
    for (const [d, a] of applied) await syncState.setApplied(db, d, a);
    const hlc = await syncState.getMeta(db, 'hlc');
    if (!hlc || compare(parse(hlc), state.seen) < 0) await syncState.setMeta(db, 'hlc', format(state.seen));
  });
}

// Checkpoint lines for the entities a batch touched (a superset is fine).
function linesFor(state: SyncState, changes: Change[]): CheckpointEntity[] {
  const keys = new Set(changes.map((c) => `${c.e}/${c.id}`));
  const out: CheckpointEntity[] = [];
  for (const line of state.checkpointEntities()) if (keys.has(`${line.e}/${line.id}`)) out.push(line);
  return out;
}
