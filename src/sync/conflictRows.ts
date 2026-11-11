import type { SQLiteDatabase } from '../db/driver';
import type { FieldConflict } from './conflicts';

// One line per conflicted field in the "Edited in two places" sheet:
// "Paycheck · 2026-09-14 · memo". Only transactions open an editor.
export interface ConflictRow {
  key: string;
  label: string;
  field: string;
  transactionId: number | null;
}

const NAMED_TABLES = new Set(['boards', 'accounts', 'category_groups', 'categories', 'payees', 'houses']);

export async function conflictRows(db: SQLiteDatabase, conflicts: FieldConflict[]): Promise<ConflictRow[]> {
  const gidsBy = new Map<string, Set<string>>();
  for (const c of conflicts) {
    if (!gidsBy.has(c.table)) gidsBy.set(c.table, new Set());
    gidsBy.get(c.table)!.add(c.gid);
  }
  const labels = new Map<string, { label: string; id: number }>();
  for (const [table, set] of gidsBy) {
    const gids = [...set];
    const marks = gids.map(() => '?').join(', ');
    if (table === 'transactions') {
      const rows = await db.getAllAsync<{ id: number; gid: string; date: string; payee: string | null }>(
        `SELECT t.id, t.gid, t.date, p.name AS payee FROM transactions t
         LEFT JOIN payees p ON p.id = t.payee_id WHERE t.gid IN (${marks})`,
        ...gids,
      );
      for (const r of rows) labels.set(`${table}/${r.gid}`, { id: r.id, label: r.payee ? `${r.payee} · ${r.date}` : r.date });
    } else if (NAMED_TABLES.has(table)) {
      const rows = await db.getAllAsync<{ id: number; gid: string; name: string | null }>(
        `SELECT id, gid, name FROM ${table} WHERE gid IN (${marks})`,
        ...gids,
      );
      for (const r of rows) labels.set(`${table}/${r.gid}`, { id: r.id, label: r.name ?? table });
    }
  }
  return conflicts.map((c) => {
    const hit = labels.get(`${c.table}/${c.gid}`);
    return {
      key: `${c.table}/${c.gid}/${c.field}`,
      label: hit?.label ?? c.table,
      field: c.field,
      transactionId: c.table === 'transactions' && hit ? hit.id : null,
    };
  });
}
