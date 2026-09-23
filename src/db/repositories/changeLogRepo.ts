import type { SQLiteDatabase } from '../../db/driver';

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
  // Whatever the first row of the group was called, when it had a name —
  // "accounts, 1 row" says a great deal less than "accounts · Chequing"
  // when you are deciding whether to undo it.
  sampleName: string | null;
}

function parse(json: string | null): Record<string, unknown> | null {
  if (json == null) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export interface ChangeGroupPage {
  groups: ChangeGroup[];
  // Pass this back as `beforeSeq` for the next page; null means there is none.
  nextBeforeSeq: number | null;
}

// Grouped by the second they happened in, which is as fine-grained as the
// trigger's own `datetime('now')` gets — and conveniently the granularity a
// single action happens at.
//
// Paged by scanning backward from `beforeSeq` in a bounded window rather than
// grouping the whole log: History is opened often, on phones several years
// old, and the log is generous about how long it holds on to rows (see
// `pruneChangeLog`) — a screen that group-bys all of it on every open is the
// "read the whole board to render part of it" mistake this app can't afford.
// A group can straddle the edge of a window, so a window is widened and
// retried until it holds a full page's worth of *complete* groups, or runs
// out of log to look at.
export async function listChangeGroups(
  db: SQLiteDatabase,
  beforeSeq?: number,
  pageSize = 30,
): Promise<ChangeGroupPage> {
  let windowSize = pageSize * 4;
  for (;;) {
    const recent = await db.getAllAsync<{
      seq: number;
      at: string;
      tbl: string;
      op: ChangeLogEntry['op'];
      before: string | null;
      after: string | null;
    }>(
      `SELECT seq, at, tbl, op, before, after FROM change_log
       WHERE seq < ? ORDER BY seq DESC LIMIT ?`,
      beforeSeq ?? Number.MAX_SAFE_INTEGER,
      windowSize,
    );
    if (recent.length === 0) return { groups: [], nextBeforeSeq: null };

    const exhausted = recent.length < windowSize;
    const windowFloor = recent[recent.length - 1].seq;

    const byKey = new Map<
      string,
      Omit<ChangeGroup, 'sampleName'> & { sample: string | null }
    >();
    // Walked newest-first, so the last update to a group's firstSeq/sample is
    // always its actual first (earliest) row — what it looked like when the
    // change started.
    for (const r of recent) {
      const key = `${r.at}\u0000${r.tbl}\u0000${r.op}`;
      const g = byKey.get(key);
      if (g) {
        g.count += 1;
        g.firstSeq = Math.min(g.firstSeq, r.seq);
        g.lastSeq = Math.max(g.lastSeq, r.seq);
        if (r.seq === g.firstSeq) g.sample = r.after ?? r.before;
      } else {
        byKey.set(key, {
          at: r.at,
          table: r.tbl,
          op: r.op,
          count: 1,
          firstSeq: r.seq,
          lastSeq: r.seq,
          sample: r.after ?? r.before,
        });
      }
    }

    let groups = [...byKey.values()].sort((a, b) => b.firstSeq - a.firstSeq);
    // A group sitting on the window's floor may continue further back than
    // this window looked — incomplete, so it isn't page-worthy yet.
    if (!exhausted) {
      groups = groups.filter((g) => g.firstSeq > windowFloor);
    }

    if (groups.length >= pageSize || exhausted) {
      const page = groups.slice(0, pageSize);
      const hasMore = groups.length > pageSize || !exhausted;
      const last = page[page.length - 1];
      return {
        groups: page.map(({ sample, ...g }) => ({
          ...g,
          sampleName: nameOf(sample),
        })),
        nextBeforeSeq: hasMore && last ? last.firstSeq : null,
      };
    }

    windowSize *= 4;
  }
}

// Only a name, and only where the row has one — an amount or a date out of
// context is noise, and every table that matters here names its rows.
function nameOf(json: string | null): string | null {
  const row = parse(json);
  const name = row?.name;
  return typeof name === 'string' && name.trim() ? name : null;
}

export async function listEntriesInGroup(
  db: SQLiteDatabase,
  group: ChangeGroup,
): Promise<ChangeLogEntry[]> {
  const rows = await db.getAllAsync<{
    seq: number;
    at: string;
    tbl: string;
    op: ChangeLogEntry['op'];
    row_id: number | null;
    before: string | null;
    after: string | null;
  }>(
    'SELECT * FROM change_log WHERE seq BETWEEN ? AND ? AND tbl = ? AND op = ? ORDER BY seq',
    group.firstSeq,
    group.lastSeq,
    group.table,
    group.op,
  );
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

function columnsAndValues(row: Record<string, unknown>): {
  columns: string[];
  values: unknown[];
} {
  const columns = Object.keys(row);
  return { columns, values: columns.map((c) => row[c]) };
}

// Puts a group of changes back, newest first so a row touched twice ends up
// as it started.
//
// The undo is itself written to the log by the same triggers — it is another
// change, not a rewrite of history, so undoing an undo works and the record
// stays honest about what happened and when.
export async function undoGroup(
  db: SQLiteDatabase,
  group: ChangeGroup,
): Promise<number> {
  return revert(db, await listEntriesInGroup(db, group));
}

// Everything written from `seq` onwards, put back — what an import needs.
//
// A large import writes for as long as it takes, so it lands as a hundred
// separate entries across several seconds and several tables, and undoing it
// one at a time is not a thing anybody would do. Rewinding to the moment
// before it started treats it as what it was: one action.
//
// Reversed newest first, so a row the import touched more than once walks
// back through each state rather than jumping to the wrong one.
export async function undoSince(
  db: SQLiteDatabase,
  seq: number,
): Promise<number> {
  const rows = await db.getAllAsync<{
    seq: number;
    at: string;
    tbl: string;
    op: ChangeLogEntry['op'];
    row_id: number | null;
    before: string | null;
    after: string | null;
  }>('SELECT * FROM change_log WHERE seq >= ? ORDER BY seq', seq);
  return revert(
    db,
    rows.map((r) => ({
      seq: r.seq,
      at: r.at,
      table: r.tbl,
      op: r.op,
      rowId: r.row_id,
      before: parse(r.before),
      after: parse(r.after),
    })),
  );
}

// How many rows a rewind would touch, so the confirmation can say so before
// anyone agrees to it.
export async function countSince(
  db: SQLiteDatabase,
  seq: number,
): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) as n FROM change_log WHERE seq >= ?',
    seq,
  );
  return row?.n ?? 0;
}

async function revert(
  db: SQLiteDatabase,
  entries: ChangeLogEntry[],
): Promise<number> {
  let undone = 0;

  await db.withTransactionAsync(async () => {
    for (const entry of [...entries].reverse()) {
      if (entry.op === 'insert' && entry.after) {
        await db.runAsync(
          `DELETE FROM ${entry.table} WHERE rowid = ?`,
          entry.rowId,
        );
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
export async function pruneChangeLog(
  db: SQLiteDatabase,
  keep = 20000,
): Promise<void> {
  await db.runAsync(
    'DELETE FROM change_log WHERE seq <= (SELECT MAX(seq) - ? FROM change_log)',
    keep,
  );
}

// The high-water mark of the log — a single number that says "this is what
// the data looked like". Comparing it against the one stored at the last
// backup answers "has anything changed since?" without diffing anything.
export async function latestChangeSeq(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ seq: number | null }>(
    'SELECT MAX(seq) as seq FROM change_log',
  );
  return row?.seq ?? 0;
}
