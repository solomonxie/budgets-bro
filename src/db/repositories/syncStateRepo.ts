import type { SQLiteDatabase } from '../driver';
import type { CheckpointEntity, VersionVector } from '../../../sync-core/types';

export type DeviceKind = 'phone' | 'browser';

export interface SyncFatal {
  kind: 'collision' | 'newer' | 'clock';
  detail: string;
  at: number;
}

export interface SyncError {
  kind: 'offline' | 'auth' | 'missing' | 'other';
  detail: string;
  at: number;
}

interface Meta {
  device: string;
  kind: DeviceKind;
  hlc: string;
  // ms to add to the local clock to get bucket time.
  offset: number;
  homeConfig: string;
  // Browser sync switch; off keeps every other key.
  enabled: boolean;
  lastSynced: number;
  lastError: SyncError | null;
  // Last change_log seq turned into ops.
  outboxCursor: number;
  nextSeq: number;
  fatal: SyncFatal | null;
  deviceName: string;
  // Bucket ms the device file was first written / last refreshed.
  deviceCreated: number;
  deviceSeen: number;
  // Other devices' names from sync/devices/<id>.json, for whose edit is whose.
  deviceNames: Record<string, string>;
  // `<e>/<gid>/<field>` → head stamps resolved here, not yet merged back.
  resolved: Record<string, string[]>;
  // First sync: 'sealed' once the ledger's adds are sealed, 'done' once
  // merge state and the ledger agree with them.
  bootstrap: 'sealed' | 'done';
}

export async function getMeta<K extends keyof Meta>(db: SQLiteDatabase, k: K): Promise<Meta[K] | null> {
  const row = await db.getFirstAsync<{ v: string }>('SELECT v FROM sync_meta WHERE k = ?', k);
  return row ? (JSON.parse(row.v) as Meta[K]) : null;
}

export async function setMeta<K extends keyof Meta>(db: SQLiteDatabase, k: K, v: Meta[K]): Promise<void> {
  await db.runAsync(
    'INSERT INTO sync_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v',
    k,
    JSON.stringify(v),
  );
}

export interface Applied {
  seq: number;
  lastKey: string;
}

export async function getApplied(db: SQLiteDatabase): Promise<Record<string, Applied>> {
  const rows = await db.getAllAsync<{ device: string; seq: number; last_key: string }>(
    'SELECT device, seq, last_key FROM sync_applied',
  );
  return Object.fromEntries(rows.map((r) => [r.device, { seq: r.seq, lastKey: r.last_key }]));
}

export async function getVersionVector(db: SQLiteDatabase): Promise<VersionVector> {
  const rows = await db.getAllAsync<{ device: string; seq: number }>('SELECT device, seq FROM sync_applied');
  return Object.fromEntries(rows.map((r) => [r.device, r.seq]));
}

export async function setApplied(db: SQLiteDatabase, device: string, applied: Applied): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_applied (device, seq, last_key) VALUES (?, ?, ?)
     ON CONFLICT(device) DO UPDATE SET seq = excluded.seq, last_key = excluded.last_key`,
    device,
    applied.seq,
    applied.lastKey,
  );
}

// change_log seqs the applier wrote: the outbox skips them (echo).
export interface SeqRange {
  lo: number;
  hi: number;
}

export async function addRemoteRange(db: SQLiteDatabase, range: SeqRange): Promise<void> {
  if (range.hi < range.lo) return;
  await db.runAsync('INSERT OR REPLACE INTO sync_remote_range (lo, hi) VALUES (?, ?)', range.lo, range.hi);
}

export async function remoteRangesAfter(db: SQLiteDatabase, seq: number): Promise<SeqRange[]> {
  return db.getAllAsync<SeqRange>('SELECT lo, hi FROM sync_remote_range WHERE hi > ? ORDER BY lo', seq);
}

export async function pruneRemoteRanges(db: SQLiteDatabase, upToSeq: number): Promise<void> {
  await db.runAsync('DELETE FROM sync_remote_range WHERE hi <= ?', upToSeq);
}

// Sealed segment bytes, PUT as-is until they land, so a retry is identical.
export interface Sealed {
  seq: number;
  key: string;
  bytes: Uint8Array;
}

export async function addSealed(db: SQLiteDatabase, sealed: Sealed): Promise<void> {
  await db.runAsync('INSERT INTO sync_sealed (seq, key, bytes) VALUES (?, ?, ?)', sealed.seq, sealed.key, sealed.bytes);
}

export async function listSealed(db: SQLiteDatabase): Promise<Sealed[]> {
  const rows = await db.getAllAsync<{ seq: number; key: string; bytes: Uint8Array | ArrayBuffer }>(
    'SELECT seq, key, bytes FROM sync_sealed ORDER BY seq',
  );
  return rows.map((r) => ({
    seq: r.seq,
    key: r.key,
    bytes: r.bytes instanceof Uint8Array ? r.bytes : new Uint8Array(r.bytes),
  }));
}

export async function deleteSealed(db: SQLiteDatabase, seq: number): Promise<void> {
  await db.runAsync('DELETE FROM sync_sealed WHERE seq = ?', seq);
}

// Merge state as checkpoint lines; loaded only when a pull runs.
const isConflicted = (line: CheckpointEntity) => Object.values(line.heads).some((h) => h.length > 1);

export async function saveEntities(db: SQLiteDatabase, lines: CheckpointEntity[]): Promise<void> {
  for (const line of lines) {
    await db.runAsync(
      `INSERT INTO sync_entity (k, line, conflicted) VALUES (?, ?, ?)
       ON CONFLICT(k) DO UPDATE SET line = excluded.line, conflicted = excluded.conflicted`,
      `${line.e}/${line.id}`,
      JSON.stringify(line),
      isConflicted(line) ? 1 : 0,
    );
  }
}

export async function loadEntities(db: SQLiteDatabase): Promise<CheckpointEntity[]> {
  const rows = await db.getAllAsync<{ line: string }>('SELECT line FROM sync_entity');
  return rows.map((r) => JSON.parse(r.line) as CheckpointEntity);
}

export async function conflictedEntities(db: SQLiteDatabase, key?: string): Promise<CheckpointEntity[]> {
  const rows = key
    ? await db.getAllAsync<{ line: string }>('SELECT line FROM sync_entity WHERE conflicted = 1 AND k = ?', key)
    : await db.getAllAsync<{ line: string }>('SELECT line FROM sync_entity WHERE conflicted = 1');
  return rows.map((r) => JSON.parse(r.line) as CheckpointEntity);
}

// A restore or a new home bucket starts over as a new device. Which bucket
// and whether sync is on are the user's choice, not this device's state.
export async function resetSyncState(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM sync_meta WHERE k NOT IN ('homeConfig', 'enabled');
    DELETE FROM sync_applied;
    DELETE FROM sync_remote_range;
    DELETE FROM sync_sealed;
    DELETE FROM sync_entity;
  `);
}
