import type { SQLiteDatabase } from '../db/driver';
import { isDemoMode } from '../db/client';
import { newGid } from '../db/gid';
import * as syncState from '../db/repositories/syncStateRepo';
import type { Bucket } from '../../sync-core/bucket';
import { utf8ToBytes } from '../../sync-core/bytes';
import { cutSegments, encodeSegment, segmentKey, segmentMaxOps } from '../../sync-core/codec';
import type { Gzip, VersionVector } from '../../sync-core/types';
import { buildOutbox } from './outbox';
import { withSyncLock } from './syncLock';

// Seals the outbox into segments and PUTs them write-once.
// PROTOCOL.md "Segments" and "Bucket layout".

export interface PushDeps {
  db: SQLiteDatabase;
  bucket: Bucket;
  gzip: Gzip;
  // Local ms; bucket time is this plus the stored offset.
  now: () => number;
  deviceName: string;
}

export interface PushResult {
  sealed: number;
  sent: number;
  // Why it stopped short of sending everything sealed, if it did.
  stopped?: 'demo' | 'fatal' | 'busy' | 'collision';
}

const QUIET_MS = 2000;
const DAY_MS = 86_400_000;

export async function ensureDevice(db: SQLiteDatabase): Promise<string> {
  const existing = await syncState.getMeta(db, 'device');
  if (existing) return existing;
  const device = newGid();
  await syncState.setMeta(db, 'device', device);
  await syncState.setMeta(db, 'kind', 'phone');
  return device;
}

export function push(deps: PushDeps): Promise<PushResult> {
  return withSyncLock(() => pushLocked(deps));
}

async function pushLocked(deps: PushDeps): Promise<PushResult> {
  const { db } = deps;
  if (await isDemoMode()) return { sealed: 0, sent: 0, stopped: 'demo' };
  if (await syncState.getMeta(db, 'fatal')) return { sealed: 0, sent: 0, stopped: 'fatal' };
  const device = await ensureDevice(db);
  const sealed = await sealOutbox(deps, device);

  // A write that joined our sealing transaction may not have committed yet;
  // sealed rows read now could still roll back. Send next time.
  if (await txnOpen(db)) return { sealed, sent: 0, stopped: 'busy' };

  const bucketNow = deps.now() + ((await syncState.getMeta(db, 'offset')) ?? 0);
  if (!(await announceDevice(deps, device, bucketNow))) return { sealed, sent: 0, stopped: 'collision' };

  let sent = 0;
  for (const s of await syncState.listSealed(db)) {
    if ((await deps.bucket.putOnce(s.key, s.bytes)) === 'collision') {
      await syncState.setMeta(db, 'fatal', { kind: 'collision', detail: s.key, at: bucketNow });
      return { sealed, sent, stopped: 'collision' };
    }
    await syncState.deleteSealed(db, s.seq);
    sent++;
  }
  return { sealed, sent };
}

// Seal before apply: every op is sealed with the vv it was created under.
async function sealOutbox(deps: PushDeps, device: string): Promise<number> {
  const { db } = deps;
  let count = 0;
  for (;;) {
    const batch = await buildOutbox(db, deps.now);
    if (!batch) return count;
    const vv = othersOnly(await syncState.getVersionVector(db), device);
    let seq = (await syncState.getMeta(db, 'nextSeq')) ?? 1;
    const segments: syncState.Sealed[] = [];
    for (const ops of cutSegments(batch.groups)) {
      segments.push({ seq, key: segmentKey(device, seq), bytes: await encodeSegment(deps.gzip, device, seq, vv, ops) });
      seq++;
    }
    await db.withTransactionAsync(async () => {
      for (const s of segments) await syncState.addSealed(db, s);
      await syncState.setMeta(db, 'outboxCursor', batch.cursor);
      await syncState.setMeta(db, 'hlc', batch.hlc);
      await syncState.setMeta(db, 'nextSeq', seq);
    });
    count += segments.length;
  }
}

function othersOnly(vv: VersionVector, device: string): VersionVector {
  const { [device]: _own, ...rest } = vv;
  return rest;
}

async function txnOpen(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ open: number }>('SELECT open FROM sync_txn');
  return row?.open === 1;
}

// Before its first write a device must find its own log prefix empty; then
// it publishes its device file, refreshed at most daily.
async function announceDevice(deps: PushDeps, device: string, bucketNow: number): Promise<boolean> {
  const { db, bucket } = deps;
  const created = await syncState.getMeta(db, 'deviceCreated');
  if (created === null) {
    if ((await bucket.list(`sync/log/${device}/`, { max: 1 })).length > 0) {
      await syncState.setMeta(db, 'fatal', {
        kind: 'collision',
        detail: `sync/log/${device}/ is not empty`,
        at: bucketNow,
      });
      return false;
    }
  } else {
    const seen = (await syncState.getMeta(db, 'deviceSeen')) ?? 0;
    if (bucketNow - seen < DAY_MS) return true;
  }
  const file = {
    device,
    name: deps.deviceName,
    kind: 'phone',
    created: created ?? bucketNow,
    lastSeen: bucketNow,
  };
  await bucket.put(
    `sync/devices/${device}.json`,
    utf8ToBytes(JSON.stringify(file)),
    'application/json',
  );
  if (created === null) await syncState.setMeta(db, 'deviceCreated', bucketNow);
  await syncState.setMeta(db, 'deviceName', deps.deviceName);
  await syncState.setMeta(db, 'deviceSeen', bucketNow);
  return true;
}

// Wired by the sync trigger (T3.5): how to reach the home bucket right now,
// or null when sync is off.
type DepsResolver = (db: SQLiteDatabase) => Promise<PushDeps | null>;
let resolveDeps: DepsResolver | null = null;
const timers = new Map<SQLiteDatabase, ReturnType<typeof setTimeout>>();

export function setPushDeps(resolver: DepsResolver | null): void {
  resolveDeps = resolver;
}

// After a local write: send after 2 s of quiet, or now once a segment's
// worth is waiting.
export function schedulePush(db: SQLiteDatabase): void {
  clearTimeout(timers.get(db));
  timers.set(db, setTimeout(() => void flushNow(db).catch(() => {}), QUIET_MS));
  void pendingRows(db)
    .then((n) => (n >= segmentMaxOps ? flushNow(db) : null))
    .catch(() => {});
}

// Also the backgrounding path.
export async function flushNow(db: SQLiteDatabase): Promise<PushResult | null> {
  clearTimeout(timers.get(db));
  timers.delete(db);
  const deps = resolveDeps ? await resolveDeps(db) : null;
  return deps ? push(deps) : null;
}

async function pendingRows(db: SQLiteDatabase): Promise<number> {
  const cursor = (await syncState.getMeta(db, 'outboxCursor')) ?? 0;
  const row = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM change_log WHERE seq > ?', cursor);
  return row?.n ?? 0;
}
