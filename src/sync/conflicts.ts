import type { SQLiteDatabase } from '../db/driver';
import * as syncState from '../db/repositories/syncStateRepo';
import { isTextField } from '../../sync-core/entities';
import type { CheckpointEntity, HeadValue, Scalar } from '../../sync-core/types';

// "Edited in two places" (docs/design/browser-sync/uiux/sync.md): a text
// field two devices changed without seeing each other's edit. Both values
// stay in the merge state as heads; picking one writes it again as a local
// edit made after both, which supersedes them on every device.

export interface ConflictValue {
  value: Scalar;
  device: string;
  // null when the device isn't known here: shown as "another device".
  deviceName: string | null;
  mine: boolean;
  at: number;
}

export interface FieldConflict {
  table: string;
  gid: string;
  field: string;
  // The value the row holds now (the newest edit), then the others.
  current: ConflictValue;
  others: ConflictValue[];
  stamps: string[];
}

// Sync never switched on → no device → no queries after the first.
const active = new WeakMap<SQLiteDatabase, boolean>();

async function syncActive(db: SQLiteDatabase): Promise<boolean> {
  let on = active.get(db);
  if (on == null) {
    on = (await syncState.getMeta(db, 'device')) != null;
    active.set(db, on);
  }
  return on;
}

// For whatever creates or resets the sync device.
export function forgetSyncPresence(db: SQLiteDatabase): void {
  active.delete(db);
}

const deviceOf = (stamp: string) => stamp.slice(stamp.indexOf('@') + 1);
const wallOf = (stamp: string) => Number(stamp.slice(0, 13));
const keyOf = (table: string, gid: string, field: string) => `${table}/${gid}/${field}`;

function fieldConflicts(
  line: CheckpointEntity,
  me: string | null,
  names: Record<string, string>,
  resolved: Record<string, string[]>,
): FieldConflict[] {
  const out: FieldConflict[] = [];
  for (const [field, heads] of Object.entries(line.heads)) {
    if (heads.length < 2 || !isTextField(line.e, field)) continue;
    const stamps = heads.map((h) => h.s).sort();
    const done = resolved[keyOf(line.e, line.id, field)];
    if (done && stamps.every((s) => done.includes(s))) continue;
    const toValue = (h: HeadValue): ConflictValue => {
      const device = deviceOf(h.s);
      return { value: h.x, device, deviceName: names[device] ?? null, mine: device === me, at: wallOf(h.s) };
    };
    const newestFirst = [...heads].sort((a, b) => (a.s < b.s ? 1 : -1));
    out.push({
      table: line.e,
      gid: line.id,
      field,
      current: toValue(newestFirst[0]),
      others: newestFirst.slice(1).map(toValue),
      stamps,
    });
  }
  return out;
}

export async function listConflicts(
  db: SQLiteDatabase,
  filter: { table?: string; gid?: string } = {},
): Promise<FieldConflict[]> {
  if (!(await syncActive(db))) return [];
  const key = filter.table && filter.gid ? `${filter.table}/${filter.gid}` : undefined;
  const lines = (await syncState.conflictedEntities(db, key)).filter(
    (l) => !filter.table || l.e === filter.table,
  );
  if (lines.length === 0) return [];
  const me = await syncState.getMeta(db, 'device');
  const names = (await syncState.getMeta(db, 'deviceNames')) ?? {};
  const resolved = (await syncState.getMeta(db, 'resolved')) ?? {};
  return lines.flatMap((l) => fieldConflicts(l, me, names, resolved));
}

// Local ids of the rows in `table` with an open conflict: one query for the
// whole list, not one per row.
export async function conflictedRowIds(db: SQLiteDatabase, table: string): Promise<Set<number>> {
  const gids = [...new Set((await listConflicts(db, { table })).map((c) => c.gid))];
  if (gids.length === 0) return new Set();
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM ${table} WHERE gid IN (${gids.map(() => '?').join(', ')})`,
    ...gids,
  );
  return new Set(rows.map((r) => r.id));
}

export async function conflictsForRow(db: SQLiteDatabase, table: string, id: number): Promise<FieldConflict[]> {
  if (!(await syncActive(db))) return [];
  const row = await db.getFirstAsync<{ gid: string | null }>(`SELECT gid FROM ${table} WHERE id = ?`, id);
  return row?.gid ? listConflicts(db, { table, gid: row.gid }) : [];
}

// Writes `value` as a fresh edit even when the row already holds it: the
// outbox only sends fields that changed, so it passes through a placeholder
// inside one transaction and leaves as one `set` of `value`.
export async function resolveConflict(db: SQLiteDatabase, conflict: FieldConflict, value: Scalar): Promise<void> {
  const { table, gid, field } = conflict;
  if (!isTextField(table, field)) throw new Error(`${table}.${field} is not conflict-tracked`);
  const placeholder = value === '\u0000' ? '\u0001' : '\u0000';
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE ${table} SET ${field} = ? WHERE gid = ?`, placeholder, gid);
    await db.runAsync(`UPDATE ${table} SET ${field} = ? WHERE gid = ?`, value, gid);
    const open = new Set(
      (await syncState.conflictedEntities(db)).flatMap((l) =>
        Object.keys(l.heads).map((f) => keyOf(l.e, l.id, f)),
      ),
    );
    const resolved = Object.fromEntries(
      Object.entries((await syncState.getMeta(db, 'resolved')) ?? {}).filter(([k]) => open.has(k)),
    );
    resolved[keyOf(table, gid, field)] = conflict.stamps;
    await syncState.setMeta(db, 'resolved', resolved);
  });
}
