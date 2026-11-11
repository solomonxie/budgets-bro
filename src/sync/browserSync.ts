import type { SQLiteDatabase } from '../db/driver';
import { isDemoMode } from '../db/client';
import * as syncState from '../db/repositories/syncStateRepo';
import type { SyncError, SyncFatal } from '../db/repositories/syncStateRepo';
import { type Bucket, BucketError, S3Bucket } from '../../sync-core/bucket';
import { bytesToUtf8 } from '../../sync-core/bytes';
import { offsetFromDate } from '../../sync-core/clock';
import { forgetState, pull } from './apply';
import { ensureBootstrapped } from './bootstrap';
import { maybePublishCheckpoint } from './checkpoint';
import { forgetSyncPresence } from './conflicts';
import { gzip } from './gzip';
import { flushNow, push, schedulePush, setPushDeps } from './push';
import type { PushDeps, PushResult } from './push';
import { getS3Connection } from './s3Provider';
import { withSyncLock } from './syncLock';

// Two-way sync with the browser extension through one home S3 config.
// docs/design/browser-sync/. The daily zip backup (cloudSync.ts) is separate
// and unchanged.

const DEVICE_NAME = 'iPhone';
// Writes landing between our push and the pull keep the pull waiting; give
// up after this many reseals and try again on the next trigger.
const SEAL_ATTEMPTS = 3;

export interface BrowserSyncStatus {
  enabled: boolean;
  homeConfig: string | null;
  lastSynced: number | null;
  pending: number;
  error: SyncError | null;
  fatal: SyncFatal | null;
}

export type SyncRunResult =
  | { skipped: 'demo' | 'disabled' }
  | { error: SyncError['kind'] }
  | { stopped: NonNullable<PushResult['stopped']> }
  | { applied: number; sent: number };

export interface Env {
  bucketFor: (db: SQLiteDatabase, configId: string, onDate: (h: string | null) => void) => Promise<Bucket | null>;
  now: () => number;
}

const defaultEnv: Env = {
  bucketFor: async (db, configId, onDate) => {
    const c = await getS3Connection(db, configId);
    if (!c) return null;
    return new S3Bucket(c, { fetch: (url, init) => fetch(url, init), onDate });
  },
  now: () => Date.now(),
};

let env = defaultEnv;
// Whether sync is on, so a local write costs nothing while it's off.
const active = new WeakMap<SQLiteDatabase, boolean>();
const running = new WeakMap<SQLiteDatabase, Promise<SyncRunResult>>();
const remoteListeners = new Set<() => void>();

export function setEnvForTests(next: Env | null): void {
  env = next ?? defaultEnv;
}

// Screens refresh through the app's own data-changed signal (useBrowserSync).
export function onRemoteChange(listener: () => void): () => void {
  remoteListeners.add(listener);
  return () => remoteListeners.delete(listener);
}

async function isActive(db: SQLiteDatabase): Promise<boolean> {
  const hit = active.get(db);
  if (hit !== undefined) return hit;
  const on = !(await isDemoMode()) && (await syncState.getMeta(db, 'enabled')) === true
    && (await syncState.getMeta(db, 'homeConfig')) !== null;
  active.set(db, on);
  return on;
}

// A different config means a different bucket: this device starts over there.
export async function enableBrowserSync(db: SQLiteDatabase, configId: string): Promise<void> {
  const home = await syncState.getMeta(db, 'homeConfig');
  if (home !== null && home !== configId) {
    await syncState.resetSyncState(db);
    forgetState(db);
  }
  await syncState.setMeta(db, 'homeConfig', configId);
  await syncState.setMeta(db, 'enabled', true);
  await syncState.setMeta(db, 'lastError', null);
  active.delete(db);
  forgetSyncPresence(db);
}

export async function disableBrowserSync(db: SQLiteDatabase): Promise<void> {
  await syncState.setMeta(db, 'enabled', false);
  active.delete(db);
  forgetSyncPresence(db);
}

export async function getBrowserSyncStatus(db: SQLiteDatabase): Promise<BrowserSyncStatus> {
  const [enabled, homeConfig, lastSynced, error, fatal, cursor] = await Promise.all([
    syncState.getMeta(db, 'enabled'),
    syncState.getMeta(db, 'homeConfig'),
    syncState.getMeta(db, 'lastSynced'),
    syncState.getMeta(db, 'lastError'),
    syncState.getMeta(db, 'fatal'),
    syncState.getMeta(db, 'outboxCursor'),
  ]);
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT count(*) FROM sync_sealed)
          + (SELECT count(*) FROM change_log WHERE seq > ?) AS n`,
    cursor ?? 0,
  );
  return {
    enabled: enabled === true,
    homeConfig,
    lastSynced,
    pending: enabled === true ? (row?.n ?? 0) : 0,
    error,
    fatal,
  };
}

// After any local write; free while sync is off.
export async function noteLocalWrite(db: SQLiteDatabase): Promise<void> {
  if (await isActive(db)) schedulePush(db);
}

export async function flushOnBackground(db: SQLiteDatabase): Promise<void> {
  if (await isActive(db)) await flushNow(db).catch(() => null);
}

interface Context {
  bucket: Bucket;
  pushDeps: PushDeps;
  offset: () => number;
}

async function context(db: SQLiteDatabase): Promise<Context | SyncError['kind']> {
  const configId = await syncState.getMeta(db, 'homeConfig');
  if (!configId) return 'missing';
  let offset = (await syncState.getMeta(db, 'offset')) ?? 0;
  const bucket = await env.bucketFor(db, configId, (h) => {
    const o = offsetFromDate(h, env.now());
    if (o !== null) offset = o;
  });
  if (!bucket) return 'missing';
  return {
    bucket,
    pushDeps: { db, bucket, gzip, now: env.now, deviceName: DEVICE_NAME },
    offset: () => offset,
  };
}

// Push wiring: the debounced and backgrounding pushes reach the bucket here.
export function installPushDeps(): void {
  setPushDeps(async (db) => {
    if (!(await isActive(db))) return null;
    const ctx = await context(db);
    return typeof ctx === 'string' ? null : ctx.pushDeps;
  });
}

// One run at a time per database; a trigger arriving mid-run shares it.
export function syncNow(db: SQLiteDatabase): Promise<SyncRunResult> {
  const inFlight = running.get(db);
  if (inFlight) return inFlight;
  const run = runSync(db)
    .catch((error: unknown) => recordError(db, classify(error), String(error)))
    .finally(() => running.delete(db));
  running.set(db, run);
  return run;
}

async function runSync(db: SQLiteDatabase): Promise<SyncRunResult> {
  if (await isDemoMode()) return { skipped: 'demo' };
  if (!(await isActive(db))) return { skipped: 'disabled' };
  const ctx = await context(db);
  if (typeof ctx === 'string') return recordError(db, ctx, 'home bucket not configured');
  const hadDevice = (await syncState.getMeta(db, 'device')) !== null;
  try {
    const boot = await ensureBootstrapped(db, ctx.bucket, { gzip, now: env.now, deviceName: DEVICE_NAME });
    if (boot === 'fatal' || boot === 'busy') return { stopped: boot };
    let pushed = await push(ctx.pushDeps);
    if (pushed.stopped) return { stopped: pushed.stopped };

    let applied: number | null = null;
    for (let i = 0; i < SEAL_ATTEMPTS && applied === null; i++) {
      // Seal before apply: pull only while every local row is sealed.
      applied = await withSyncLock(async () => {
        if (await unsealed(db)) return null;
        await refreshDeviceNames(db, ctx.bucket);
        const device = (await syncState.getMeta(db, 'device'))!;
        const result = await pull({ db, bucket: ctx.bucket, gzip, device, now: () => env.now() + ctx.offset() });
        return result.applied;
      });
      if (applied === null) {
        pushed = await push(ctx.pushDeps);
        if (pushed.stopped) return { stopped: pushed.stopped };
      }
    }

    let sent = pushed.sent;
    if (applied) {
      for (const listener of remoteListeners) listener();
      const again = await push(ctx.pushDeps);
      sent += again.sent;
    }
    await syncState.setMeta(db, 'offset', ctx.offset());
    if (applied !== null) {
      await syncState.setMeta(db, 'lastSynced', env.now());
      await syncState.setMeta(db, 'lastError', null);
      await maybePublishCheckpoint(db, ctx.bucket, env.now() + ctx.offset());
    }
    return { applied: applied ?? 0, sent };
  } catch (error) {
    return recordError(db, classify(error), error instanceof Error ? error.message : String(error));
  } finally {
    if (!hadDevice) forgetSyncPresence(db);
  }
}

async function unsealed(db: SQLiteDatabase): Promise<boolean> {
  const cursor = (await syncState.getMeta(db, 'outboxCursor')) ?? 0;
  const row = await db.getFirstAsync<{ n: number }>('SELECT max(seq) AS n FROM change_log');
  return (row?.n ?? 0) > cursor;
}

async function refreshDeviceNames(db: SQLiteDatabase, bucket: Bucket): Promise<void> {
  const own = await syncState.getMeta(db, 'device');
  const names: Record<string, string> = {};
  for (const o of await bucket.list('sync/devices/')) {
    const id = /^sync\/devices\/([^/]+)\.json$/.exec(o.key)?.[1];
    if (!id || id === own) continue;
    const bytes = await bucket.get(o.key);
    if (!bytes) continue;
    try {
      const file = JSON.parse(bytesToUtf8(bytes)) as { name?: unknown };
      if (typeof file.name === 'string' && file.name) names[id] = file.name;
    } catch {
      // A device file we can't read just goes unnamed.
    }
  }
  await syncState.setMeta(db, 'deviceNames', names);
}

function classify(error: unknown): SyncError['kind'] {
  if (error instanceof BucketError) return error.status === 401 || error.status === 403 ? 'auth' : 'other';
  if (error instanceof TypeError) return 'offline';
  return 'other';
}

async function recordError(db: SQLiteDatabase, kind: SyncError['kind'], detail: string): Promise<SyncRunResult> {
  await syncState.setMeta(db, 'lastError', { kind, detail, at: env.now() }).catch(() => {});
  return { error: kind };
}

export interface SyncDevice {
  id: string;
  name: string;
  kind: 'phone' | 'browser';
  lastSeen: number | null;
  mine: boolean;
}

// The Devices sheet: read from sync/devices/ when it opens, never before.
export async function listSyncDevices(db: SQLiteDatabase): Promise<SyncDevice[]> {
  const own = await syncState.getMeta(db, 'device');
  const ctx = await context(db);
  if (typeof ctx === 'string') return [];
  const out: SyncDevice[] = [];
  for (const o of await ctx.bucket.list('sync/devices/')) {
    const id = /^sync\/devices\/([^/]+)\.json$/.exec(o.key)?.[1];
    if (!id) continue;
    const bytes = await ctx.bucket.get(o.key);
    if (!bytes) continue;
    try {
      const f = JSON.parse(bytesToUtf8(bytes)) as { name?: unknown; kind?: unknown; lastSeen?: unknown };
      out.push({
        id,
        name: typeof f.name === 'string' && f.name ? f.name : id.slice(0, 8),
        kind: f.kind === 'phone' ? 'phone' : 'browser',
        lastSeen: typeof f.lastSeen === 'number' ? f.lastSeen : null,
        mine: id === own,
      });
    } catch {
      // Unreadable device file: left out of the list.
    }
  }
  return out.sort((a, b) => Number(b.mine) - Number(a.mine) || (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
}

// Removes the device file only: its past edits stay in the log, and its key
// still works. A device that syncs again writes its file back.
export async function forgetSyncDevice(db: SQLiteDatabase, id: string): Promise<void> {
  const ctx = await context(db);
  if (typeof ctx === 'string' || !ctx.bucket.delete) return;
  await ctx.bucket.delete(`sync/devices/${id}.json`);
  const names = { ...((await syncState.getMeta(db, 'deviceNames')) ?? {}) };
  delete names[id];
  await syncState.setMeta(db, 'deviceNames', names);
}
