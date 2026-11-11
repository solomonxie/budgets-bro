import type { SQLiteDatabase } from '../db/driver';
import { isDemoMode } from '../db/client';
import { newGid } from '../db/gid';
import * as syncState from '../db/repositories/syncStateRepo';
import type { Bucket } from '../../sync-core/bucket';
import { Clock, compare, format, parse, tooFarAhead, zero, type Hlc } from '../../sync-core/clock';
import {
  checkpointKey,
  decodeCheckpoint,
  decodeSegment,
  encodeCheckpoint,
  hlcOfCheckpointKey,
  segmentKey,
  seqOf,
} from '../../sync-core/codec';
import { budgetEntryGid, entities } from '../../sync-core/entities';
import { SyncState } from '../../sync-core/merge';
import { type Group, type Gzip, NewerProtocol } from '../../sync-core/types';
import { ORDER, adoptState, forgetState, writeChanges } from './apply';
import { gzip as phoneGzip } from './gzip';
import { type GidMap, type Row, addFields, remember } from './outbox';
import { ensureDevice, othersOnly, push, sealGroups, txnOpen } from './push';
import { withSyncLock } from './syncLock';

// First sync on this install. PROTOCOL.md "Checkpoint" / "Bootstrap".
//
// One path for both cases: the cloud's state (newest checkpoint + every other
// device's log after it, empty for a new bucket) is merged in memory first,
// then every local row the cloud doesn't know is sealed as an `add`, then
// both are written to the ledger and merge state together.
//
// Matching rule: a local row and a cloud entity are the same row when they
// have the same gid (a restored backup keeps gids). For those the cloud's
// values win and nothing is sent; cloud entities with no local row are
// inserted; local rows with no cloud entity are sent as `add`. Nothing local
// is deleted for being missing from the cloud — only for being deleted there.

export type BootstrapOutcome = 'done' | 'joined' | 'already' | 'busy' | 'fatal';

export interface BootstrapOptions {
  gzip?: Gzip;
  // Local ms; bucket time is this plus the stored offset.
  now?: () => number;
  deviceName?: string;
}

const PAGE = 1000;

export async function ensureBootstrapped(
  db: SQLiteDatabase,
  bucket: Bucket,
  opts: BootstrapOptions = {},
): Promise<BootstrapOutcome> {
  const gz = opts.gzip ?? phoneGzip;
  const now = opts.now ?? Date.now;
  // Demo data never leaves the phone; try again once out of demo mode.
  if (await isDemoMode()) return 'busy';
  if (await syncState.getMeta(db, 'fatal')) return 'fatal';
  if ((await syncState.getMeta(db, 'bootstrap')) === 'done') return 'already';

  const outcome = await withSyncLock(() => bootstrapLocked(db, bucket, gz, now));
  if (outcome !== 'done' && outcome !== 'joined') return outcome;

  const pushed = await push({ db, bucket, gzip: gz, now, deviceName: opts.deviceName ?? 'iPhone' });
  if (pushed.stopped === 'collision' || pushed.stopped === 'fatal') return 'fatal';
  // A joining device found a checkpoint already; a new library needs one so
  // the browser has something to load.
  if (outcome === 'done') await publishCheckpoint(db, bucket, gz);
  return outcome;
}

async function bootstrapLocked(
  db: SQLiteDatabase,
  bucket: Bucket,
  gz: Gzip,
  now: () => number,
): Promise<BootstrapOutcome> {
  if ((await syncState.getMeta(db, 'bootstrap')) === 'done') return 'already';
  const device = await ensureDevice(db);
  const offset = (await syncState.getMeta(db, 'offset')) ?? 0;
  const bucketNow = () => now() + offset;

  let state: SyncState;
  try {
    state = await loadCloud(bucket, gz, device, bucketNow());
  } catch (error) {
    if (!(error instanceof NewerProtocol)) throw error;
    await syncState.setMeta(db, 'fatal', { kind: 'newer', detail: `checkpoint v${error.v}`, at: bucketNow() });
    return 'fatal';
  }
  const joined = state.entities.size > 0;

  // Resuming after a crash past sealing: the adds are in sync_sealed or the
  // bucket already, and the cursor has moved past the history they cover.
  if ((await syncState.getMeta(db, 'bootstrap')) !== 'sealed') {
    if (await txnOpen(db)) return 'busy';
    await backfillGids(db);
    // Read before the tables: a write after this point reaches the outbox
    // (an add of a row the snapshot also has is harmless — same values).
    const cursor = (await db.getFirstAsync<{ s: number | null }>('SELECT max(seq) AS s FROM change_log'))?.s ?? 0;
    const saved = await syncState.getMeta(db, 'hlc');
    const clock = new Clock(saved ? parse(saved) : zero, now);
    clock.offset = offset;
    clock.receive(state.seen);
    const groups = await ledgerAdds(db, state, clock);
    await sealGroups(db, gz, device, groups, othersOnly(state.vv, device), async () => {
      await syncState.setMeta(db, 'outboxCursor', cursor);
      await syncState.setMeta(db, 'hlc', format(clock.last));
      await syncState.setMeta(db, 'bootstrap', 'sealed');
    });
  }

  await mergeOwnLog(db, bucket, gz, device, state, bucketNow());
  const applied = new Map<string, syncState.Applied>();
  for (const [d, seq] of Object.entries(state.vv)) applied.set(d, { seq, lastKey: segmentKey(d, seq) });
  forgetState(db);
  await writeChanges(db, state, applied);
  await syncState.setMeta(db, 'bootstrap', 'done');
  adoptState(db, state);
  return joined ? 'joined' : 'done';
}

// Newest checkpoint by hlc, then each other device's segments after it.
// A device whose log has a gap or runs too far ahead stops there; the
// ordinary pull picks it up later.
async function loadCloud(bucket: Bucket, gz: Gzip, device: string, bucketNow: number): Promise<SyncState> {
  let state = new SyncState();
  let newest: { key: string; h: string } | null = null;
  for (const o of await bucket.list('sync/checkpoints/')) {
    const h = hlcOfCheckpointKey(o.key);
    if (h !== null && (!newest || h > newest.h)) newest = { key: o.key, h };
  }
  if (newest) {
    const bytes = await bucket.get(newest.key);
    if (bytes) {
      const cp = await decodeCheckpoint(gz, bytes);
      state = SyncState.fromCheckpoint(cp.header, cp.entities);
    }
  }

  const listed = await bucket.list('sync/devices/');
  const ids = listed.map((o) => /^sync\/devices\/([^/]+)\.json$/.exec(o.key)?.[1]).filter((x): x is string => !!x);
  for (const d of [...new Set([...Object.keys(state.vv), ...ids])].sort()) {
    if (d === device) continue;
    const have = state.vv[d];
    const objects = await bucket.list(`sync/log/${d}/`, have ? { startAfter: segmentKey(d, have) } : {});
    const bySeq = new Map(objects.map((o) => [seqOf(o.key), o]));
    for (let seq = (have ?? 0) + 1; bySeq.has(seq); seq++) {
      const o = bySeq.get(seq)!;
      const bytes = await bucket.get(o.key);
      if (!bytes) break;
      const segment = await decodeSegment(gz, bytes, o.lastModified);
      if (segment.ops.some((op) => tooFarAhead(parse(op.h), bucketNow))) break;
      state.applySegment(segment);
    }
  }
  return state;
}

// Rows written by a build that had migration 046 but not gid-on-insert get
// one now, so every row can be sent. Budget entries derive theirs.
async function backfillGids(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of ORDER) {
      const rows =
        table === 'budget_entries'
          ? await db.getAllAsync<{ id: number; cg: string | null; month: string }>(
              `SELECT b.id, c.gid AS cg, b.month FROM budget_entries b
               LEFT JOIN categories c ON c.id = b.category_id WHERE b.gid IS NULL`,
            )
          : await db.getAllAsync<{ id: number; cg: null; month: null }>(
              `SELECT id, NULL AS cg, NULL AS month FROM ${table} WHERE gid IS NULL`,
            );
      for (const r of rows) {
        const gid = r.cg && r.month ? budgetEntryGid(r.cg, r.month) : newGid();
        await db.runAsync(`UPDATE ${table} SET gid = ? WHERE id = ?`, gid, r.id);
      }
    }
  });
}

// One `add` per local row the cloud has no entity for, parents first, each
// its own group (PROTOCOL.md: bootstrap ops need no grouping).
async function ledgerAdds(db: SQLiteDatabase, cloud: SyncState, clock: Clock): Promise<Group[]> {
  const gids: GidMap = new Map();
  const targets = new Set(Object.values(entities).flatMap((s) => Object.values(s.fks).map((fk) => fk.to)));
  for (const table of targets) {
    for await (const page of pages<{ id: number; gid: string }>(db, table, 'id, gid')) {
      for (const r of page) remember(gids, table, r);
    }
  }

  const groups: Group[] = [];
  for (const e of ORDER) {
    for await (const page of pages<Row & { id: number; gid: string }>(db, e, '*')) {
      for (const row of page) {
        if (cloud.entities.get(`${e}/${row.gid}`)?.exists) continue;
        const h = format(clock.tick());
        groups.push([{ h, e, id: row.gid, o: 'add', x: addFields(e, row, gids) }]);
      }
    }
  }
  return groups;
}

// Paged by id, so no single read holds a whole large table; each await
// lets the UI run between pages.
async function* pages<T>(db: SQLiteDatabase, table: string, what: string): AsyncGenerator<T[]> {
  let after = 0;
  for (;;) {
    const rows = await db.getAllAsync<T & { id: number }>(
      `SELECT ${what} FROM ${table} WHERE id > ? ORDER BY id LIMIT ?`,
      after,
      PAGE,
    );
    if (rows.length === 0) return;
    yield rows;
    after = rows[rows.length - 1].id;
    if (rows.length < PAGE) return;
  }
}

// This device's own segments — sealed locally, uploaded, or both after a
// crash mid-push — merged after the cloud's, as the applier does.
async function mergeOwnLog(
  db: SQLiteDatabase,
  bucket: Bucket,
  gz: Gzip,
  device: string,
  state: SyncState,
  bucketNow: number,
): Promise<void> {
  const sources = new Map<number, () => Promise<{ bytes: Uint8Array | null; lastModified: number }>>();
  for (const o of await bucket.list(`sync/log/${device}/`)) {
    const seq = seqOf(o.key);
    if (seq !== null) sources.set(seq, async () => ({ bytes: await bucket.get(o.key), lastModified: o.lastModified }));
  }
  for (const s of await syncState.listSealed(db)) {
    sources.set(s.seq, async () => ({ bytes: s.bytes, lastModified: bucketNow }));
  }
  for (let seq = (state.vv[device] ?? 0) + 1; sources.has(seq); seq++) {
    const { bytes, lastModified } = await sources.get(seq)!();
    if (!bytes) break;
    state.applySegment(await decodeSegment(gz, bytes, lastModified));
  }
}

// The merged state as `sync/checkpoints/<device>/<hlc>.ndjson.gz`, h = the
// newest stamp in it. Only once every own segment is in the bucket, so no
// reader is handed a version vector ahead of the log. Also T3.6's daily job.
export function publishCheckpoint(
  db: SQLiteDatabase,
  bucket: Bucket,
  gz: Gzip = phoneGzip,
): Promise<string | null> {
  return withSyncLock(async () => {
    if (await isDemoMode()) return null;
    const device = await syncState.getMeta(db, 'device');
    if (!device || (await syncState.listSealed(db)).length > 0) return null;
    const lines = await syncState.loadEntities(db);
    if (lines.length === 0) return null;
    lines.sort((a, b) => (`${a.e}/${a.id}` < `${b.e}/${b.id}` ? -1 : 1));
    let h: Hlc = zero;
    for (const line of lines) {
      for (const v of Object.values(line.f)) {
        const at = parse(v.s.slice(0, v.s.indexOf('@')));
        if (compare(at, h) > 0) h = at;
      }
    }
    const vv = await syncState.getVersionVector(db);
    const key = checkpointKey(device, format(h));
    const bytes = await encodeCheckpoint(gz, { d: device, h: format(h), vv }, lines);
    // Same key, other bytes: an equal-h checkpoint is already there. Skip.
    return (await bucket.putOnce(key, bytes)) === 'collision' ? null : key;
  });
}
