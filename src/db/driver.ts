import { open, type DB } from '@op-engineering/op-sqlite';
import { splitStatements } from './sqlText';

// The database interface the whole app is written against — every repository
// takes an `SQLiteDatabase`. It is deliberately the five methods actually
// used, so the engine underneath can change without touching call sites (it
// already has once: this was expo-sqlite's own type).
export type SQLParam = string | number | boolean | null | ArrayBuffer | Uint8Array;

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface SQLiteDatabase {
  runAsync(sql: string, ...params: SQLParam[]): Promise<RunResult>;
  getAllAsync<T>(sql: string, ...params: SQLParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: SQLParam[]): Promise<T | null>;
  // Takes a whole script — migrations are written one script each.
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

// Callers pass parameters variadically; some pass a single array for an
// `IN (?, ?, ?)` list. Both arrive here as the rest argument.
function flatten(params: SQLParam[]): SQLParam[] {
  return params.length === 1 && Array.isArray(params[0]) ? (params[0] as SQLParam[]) : params;
}

function wrap(db: DB): SQLiteDatabase {
  // BEGIN/COMMIT on the connection rather than the engine's own transaction
  // helper: callers run their statements against the same `db` they already
  // hold, not a transaction handle passed into the callback.
  let depth = 0;

  return {
    async runAsync(sql, ...params) {
      const result = await db.execute(sql, flatten(params));
      return {
        lastInsertRowId: result.insertId ?? 0,
        changes: result.rowsAffected ?? 0,
      };
    },
    async getAllAsync<T>(sql: string, ...params: SQLParam[]) {
      const result = await db.execute(sql, flatten(params));
      return (result.rows ?? []) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: SQLParam[]) {
      const result = await db.execute(sql, flatten(params));
      return ((result.rows ?? [])[0] as T) ?? null;
    },
    async execAsync(sql) {
      for (const statement of splitStatements(sql)) {
        await db.execute(statement);
      }
    },
    async withTransactionAsync(fn) {
      // Nested calls join the outer transaction — SQLite has no nested
      // BEGIN, and a repository method that opens one may be called from
      // another that already did.
      if (depth > 0) {
        depth++;
        try {
          await fn();
        } finally {
          depth--;
        }
        return;
      }
      depth = 1;
      await db.execute('BEGIN');
      try {
        await fn();
        await db.execute('COMMIT');
      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      } finally {
        depth = 0;
      }
    },
  };
}

export function openDatabase(name: string, directory: string): SQLiteDatabase {
  return wrap(open({ name, location: directory }));
}
