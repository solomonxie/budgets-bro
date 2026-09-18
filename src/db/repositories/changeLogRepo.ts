import type { SQLiteDatabase } from 'expo-sqlite';

export interface ChangeLogEntry {
  seq: number;
  at: string;
  table: string;
  op: 'insert' | 'update' | 'delete';
  rowId: number | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

// One user-visible change, which is usually several rows: a bulk relabel or a
// migration writes a row at a time, and nobody wants to read those one by
// one, or undo them one by one.
export interface ChangeGroup {
  at: string;
  table: string;
  op: ChangeLogEntry['op'];
  count: number;
  firstSeq: number;
  lastSeq: number;
}

function parse(json: string | null): Record<string, unknown> | null {
  if (json == null) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Grouped by the second they happened in, which is as fine-grained as the
// trigger's own `datetime('now')` gets — and conveniently the granularity a
// single action happens at.
export async function listChangeGroups(db: SQLiteDatabase, limit = 100): Promise<ChangeGroup[]> {
  return db.getAllAsync<ChangeGroup>(
    `SELECT at, tbl as "table", op, COUNT(*) as count, MIN(seq) as firstSeq, MAX(seq) as lastSeq
     FROM change_log GROUP BY at, tbl, op ORDER BY firstSeq DESC LIMIT ?`,
    limit,
  );
}

export async function listEntriesInGroup(db: SQLiteDatabase, group: ChangeGroup): Promise<ChangeLogEntry[]> {
  const rows = await db.getAllAsync<{
    seq: number;
    at: string;
    tbl: string;
    op: ChangeLogEntry['op'];
    row_id: number | null;
    before: string | null;
    after: string | null;
  }>('SELECT * FROM change_log WHERE seq BETWEEN ? AND ? AND tbl = ? AND op = ? ORDER BY seq', group.firstSeq, group.lastSeq, group.table, group.op);
  return rows.map((r) => ({
    seq: r.seq,
    at: r.at,
    table: r.tbl,
    op: r.op,
    rowId: r.row_id,
    before: parse(r.before),
    after: parse(r.after),
  }));
}

function columnsAndValues(row: Record<string, unknown>): { columns: string[]; values: unknown[] } {
  const columns = Object.keys(row);
  return { columns, values: columns.map((c) => row[c]) };
}

// Puts a group of changes back, newest first so a row touched twice ends up
// as it started.
//
// The undo is itself written to the log by the same triggers — it is another
// change, not a rewrite of history, so undoing an undo works and the record
// stays honest about what happened and when.
export async function undoGroup(db: SQLiteDatabase, group: ChangeGroup): Promise<number> {
  const entries = await listEntriesInGroup(db, group);
  let undone = 0;

  await db.withTransactionAsync(async () => {
    for (const entry of [...entries].reverse()) {
      if (entry.op === 'insert' && entry.after) {
        await db.runAsync(`DELETE FROM ${entry.table} WHERE rowid = ?`, entry.rowId);
        undone++;
        continue;
      }
      if (entry.before == null) continue;
      const { columns, values } = columnsAndValues(entry.before);
      if (entry.op === 'delete') {
        await db.runAsync(
          `INSERT OR REPLACE INTO ${entry.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          ...(values as never[]),
        );
        undone++;
        continue;
      }
      await db.runAsync(
        `UPDATE ${entry.table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE rowid = ?`,
        ...(values as never[]),
        entry.rowId,
      );
      undone++;
    }
  });
  return undone;
}

// Keeps the log from growing without end. Generous, because entries are small
// and the whole point is being able to reach back past something that turned
// out to be wrong days later.
export async function pruneChangeLog(db: SQLiteDatabase, keep = 20000): Promise<void> {
  await db.runAsync(
    'DELETE FROM change_log WHERE seq <= (SELECT MAX(seq) - ? FROM change_log)',
    keep,
  );
}

// The high-water mark of the log — a single number that says "this is what
// the data looked like". Comparing it against the one stored at the last
// backup answers "has anything changed since?" without diffing anything.
export async function latestChangeSeq(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ seq: number | null }>('SELECT MAX(seq) as seq FROM change_log');
  return row?.seq ?? 0;
}
