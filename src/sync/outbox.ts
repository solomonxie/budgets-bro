import type { SQLiteDatabase } from '../db/driver';
import { isDemoMode } from '../db/client';
import * as syncStateRepo from '../db/repositories/syncStateRepo';
import type { SeqRange } from '../db/repositories/syncStateRepo';
import { Clock, format, parse, zero } from '../../sync-core/clock';
import { entities } from '../../sync-core/entities';
import { syncedColumns } from '../../sync-core/columns';
import type { Group, Scalar, WireOp } from '../../sync-core/types';

// Local writes → protocol ops (PROTOCOL.md "Mapping local writes to ops").
// The source is change_log, not the repos: the triggers see every write,
// migrations and repairs included.

export interface OutboxBatch {
  groups: Group[];
  // Last change_log seq consumed, skipped rows included. The pusher stores
  // it in the same transaction as the sealed segments, so a crash between
  // the two re-reads the same rows rather than losing or doubling them.
  cursor: number;
  // Clock after this batch's ticks, persisted alongside the cursor.
  hlc: string;
}

interface LogRow {
  seq: number;
  tbl: string;
  op: 'insert' | 'update' | 'delete';
  row_id: number | null;
  before: string | null;
  after: string | null;
  txn: number | null;
}

type Row = Record<string, Scalar>;

const BATCH_ROWS = 5000;
const IN_CHUNK = 500;

// Null when there is nothing to send: demo data, nothing new, or a
// transaction still open on this connection (retry after it commits).
export async function buildOutbox(
  db: SQLiteDatabase,
  now: () => number = Date.now,
): Promise<OutboxBatch | null> {
  if (await isDemoMode()) return null;
  const from = (await syncStateRepo.getMeta(db, 'outboxCursor')) ?? 0;
  const rows = await readBatch(db, from);
  if (rows === null || rows.length === 0) return null;

  const cursor = rows[rows.length - 1].seq;
  const remote = await syncStateRepo.remoteRangesAfter(db, from);
  const local = rows.filter((r) => entities[r.tbl] && !inRanges(r.seq, remote));

  const parsed = local.map((r) => ({
    ...r,
    beforeRow: parseRow(r.before),
    afterRow: parseRow(r.after),
  }));
  const gids = await resolveGids(db, parsed);

  const clock = new Clock(await loadHlc(db), now);
  clock.offset = (await syncStateRepo.getMeta(db, 'offset')) ?? 0;

  const groups: Group[] = [];
  for (const run of runsByTxn(parsed)) {
    const h = clock.tick();
    const group = toGroup(run, format(h), h.wall, gids);
    if (group.length > 0) groups.push(group);
  }
  return { groups, cursor, hlc: format(clock.last) };
}

// One statement, so it sees either no open transaction and every row it
// returns committed, or nothing. A batch that fills up drops its last
// transaction (it may continue past the limit) unless that is all there is,
// in which case the rest of it is read too.
async function readBatch(db: SQLiteDatabase, from: number): Promise<LogRow[] | null> {
  const rows = await db.getAllAsync<LogRow & { open: number }>(
    `SELECT c.seq, c.tbl, c.op, c.row_id, c.before, c.after, c.txn, t.open
     FROM sync_txn t LEFT JOIN change_log c ON c.seq > ?
     ORDER BY c.seq LIMIT ?`,
    from,
    BATCH_ROWS,
  );
  if (rows.length === 0 || rows[0].open === 1) return null;
  if (rows[0].seq == null) return [];
  if (rows.length < BATCH_ROWS) return rows;

  const lastTxn = rows[rows.length - 1].txn;
  const kept = rows.filter((r) => r.txn !== lastTxn);
  if (kept.length > 0) return kept;
  const rest = await db.getAllAsync<LogRow & { open: number }>(
    `SELECT c.seq, c.tbl, c.op, c.row_id, c.before, c.after, c.txn, t.open
     FROM sync_txn t JOIN change_log c ON c.seq > ? AND c.txn IS ?
     ORDER BY c.seq`,
    rows[rows.length - 1].seq,
    lastTxn,
  );
  if (rest.some((r) => r.open === 1)) return null;
  return [...rows, ...rest];
}

async function loadHlc(db: SQLiteDatabase) {
  const saved = await syncStateRepo.getMeta(db, 'hlc');
  return saved ? parse(saved) : zero;
}

function inRanges(seq: number, ranges: SeqRange[]): boolean {
  return ranges.some((r) => seq >= r.lo && seq <= r.hi);
}

function parseRow(json: string | null): Row | null {
  if (json == null) return null;
  try {
    return JSON.parse(json) as Row;
  } catch {
    return null;
  }
}

interface Parsed extends LogRow {
  beforeRow: Row | null;
  afterRow: Row | null;
}

// Consecutive rows written under one marker. Rows from before migration 048
// (txn null) and autocommit writes after a COMMIT share a marker with their
// neighbours, which only makes a group coarser — never splits a transaction.
function runsByTxn(rows: Parsed[]): Parsed[][] {
  const runs: Parsed[][] = [];
  for (const row of rows) {
    const last = runs[runs.length - 1];
    if (last && last[0].txn === row.txn) last.push(row);
    else runs.push([row]);
  }
  return runs;
}

type GidMap = Map<string, Map<number, string>>;

const gidOf = (gids: GidMap, table: string, id: number): string | undefined =>
  gids.get(table)?.get(id);

function remember(gids: GidMap, table: string, row: Row | null) {
  if (!row || typeof row.id !== 'number' || typeof row.gid !== 'string') return;
  let byId = gids.get(table);
  if (!byId) gids.set(table, (byId = new Map()));
  byId.set(row.id, row.gid);
}

// Every local id this batch mentions — each row's own and every FK — mapped
// to its gid: first from the logged rows themselves, then the live tables,
// then the delete entry of a row that is gone (AUTOINCREMENT ids are never
// reused, so that entry is unambiguous).
async function resolveGids(db: SQLiteDatabase, rows: Parsed[]): Promise<GidMap> {
  const gids: GidMap = new Map();
  const wanted = new Map<string, Set<number>>();
  const want = (table: string, id: Scalar | undefined) => {
    if (typeof id !== 'number') return;
    let ids = wanted.get(table);
    if (!ids) wanted.set(table, (ids = new Set()));
    ids.add(id);
  };

  for (const r of rows) {
    remember(gids, r.tbl, r.beforeRow);
    remember(gids, r.tbl, r.afterRow);
    want(r.tbl, r.row_id);
    for (const [field, fk] of Object.entries(entities[r.tbl].fks)) {
      want(fk.to, r.beforeRow?.[field]);
      want(fk.to, r.afterRow?.[field]);
    }
  }

  for (const [table, ids] of wanted) {
    const missing = [...ids].filter((id) => gidOf(gids, table, id) === undefined);
    for (const chunk of chunks(missing)) {
      const marks = chunk.map(() => '?').join(', ');
      const live = await db.getAllAsync<{ id: number; gid: string | null }>(
        `SELECT id, gid FROM ${table} WHERE id IN (${marks})`,
        ...chunk,
      );
      for (const row of live) remember(gids, table, row);
      const gone = chunk.filter((id) => gidOf(gids, table, id) === undefined);
      if (gone.length === 0) continue;
      const deleted = await db.getAllAsync<{ id: number; gid: string | null }>(
        `SELECT row_id AS id, json_extract(before, '$.gid') AS gid FROM change_log
         WHERE tbl = ? AND op = 'delete' AND row_id IN (${gone.map(() => '?').join(', ')})`,
        table,
        ...gone,
      );
      for (const row of deleted) remember(gids, table, row);
    }
  }
  return gids;
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IN_CHUNK) out.push(items.slice(i, i + IN_CHUNK));
  return out;
}

// Per entity in the group: an `add` absorbs every later write to it, and a
// field set twice keeps its last value — so (e, id, f) appears once.
interface Pending {
  e: string;
  id: string;
  add: Row | null;
  sets: Map<string, Scalar>;
}

function toGroup(run: Parsed[], h: string, wall: number, gids: GidMap): Group {
  const pending = new Map<string, Pending>();
  const entry = (e: string, id: string): Pending => {
    const key = `${e}/${id}`;
    let p = pending.get(key);
    if (!p) pending.set(key, (p = { e, id, add: null, sets: new Map() }));
    return p;
  };
  const set = (p: Pending, f: string, x: Scalar) => {
    if (p.add) p.add[f] = x;
    else p.sets.set(f, x);
  };

  for (const r of run) {
    const e = r.tbl;
    const self = r.afterRow ?? r.beforeRow;
    const id =
      (typeof self?.gid === 'string' ? self.gid : undefined) ??
      (r.row_id != null ? gidOf(gids, e, r.row_id) : undefined);
    if (!id) continue;
    const p = entry(e, id);

    if (r.op === 'insert' && r.afterRow) {
      const x: Row = {};
      for (const f of syncedColumns[e]) x[f] = wireValue(e, f, r.afterRow[f], gids);
      x.deleted = null;
      p.add = x;
      p.sets.clear();
    } else if (r.op === 'update' && r.afterRow) {
      for (const f of syncedColumns[e]) {
        const before = r.beforeRow?.[f] ?? null;
        const after = r.afterRow[f] ?? null;
        if (before !== after) set(p, f, wireValue(e, f, after, gids));
      }
    } else if (r.op === 'delete') {
      set(p, 'deleted', wall);
    }
  }

  const ops: WireOp[] = [];
  for (const p of pending.values()) {
    if (p.add) ops.push({ h, e: p.e, id: p.id, o: 'add', x: p.add });
    for (const [f, x] of p.sets) ops.push({ h, e: p.e, id: p.id, o: 'set', f, x });
  }
  return ops;
}

// FK fields travel as the target's gid. One that can't be found (a row
// deleted before migration 046 logged gids) goes as null.
function wireValue(e: string, f: string, value: Scalar | undefined, gids: GidMap): Scalar {
  if (value === undefined || value === null) return null;
  const fk = entities[e].fks[f];
  if (!fk) return value;
  return typeof value === 'number' ? (gidOf(gids, fk.to, value) ?? null) : null;
}
