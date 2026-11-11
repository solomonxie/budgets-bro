/**
 * @jest-environment node
 */
import JSZip from 'jszip';
import { openDatabase } from '../db/driver';
import type { SQLiteDatabase } from '../db/driver';
import { migrate } from '../db/migrate';
import { buildBackupZip } from '../sync/buildBackup';
import { parseBackupZip } from '../sync/parseBackupZip';
import { getMeta, setMeta } from '../db/repositories/syncStateRepo';
import { budgetEntryGid } from '../../sync-core/entities';
import { importAppExport } from './appExportImporter';

jest.mock('@op-engineering/op-sqlite', () => {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  return {
    IOS_DOCUMENT_PATH: '/documents',
    open: () => {
      const sqlite = new DatabaseSync(':memory:');
      return {
        execute: async (sql: string, params: unknown[] = []) => {
          const stmt = sqlite.prepare(sql);
          if (stmt.columns().length > 0) return { rows: stmt.all(...(params as never[])) };
          const r = stmt.run(...(params as never[]));
          return { rows: [], rowsAffected: Number(r.changes), insertId: Number(r.lastInsertRowid) };
        },
      };
    },
  };
});
jest.mock('../db/preMigrationSnapshot', () => ({ takeSnapshot: async () => {} }));

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function freshDb(name: string): Promise<SQLiteDatabase> {
  const db = openDatabase(name, '/documents/SQLite');
  await migrate(db);
  return db;
}

async function seedBoard(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    UPDATE boards SET gid = 'board-gid' WHERE id = 1;
    INSERT INTO accounts (id, name, type, board_id, gid) VALUES (1, 'Chequing', 'cash', 1, 'acct-gid');
    INSERT INTO category_groups (id, name, board_id, gid) VALUES (1, 'Bills', 1, 'group-gid');
    INSERT INTO categories (id, group_id, name, board_id, gid) VALUES (1, 1, 'Rent', 1, 'cat-gid');
    INSERT INTO payees (id, name, board_id, gid) VALUES (1, 'Landlord', 1, 'payee-gid');
    INSERT INTO budget_entries (category_id, month, assigned_cents, board_id, gid)
      VALUES (1, '2026-11', 100000, 1, 'stale-be-gid');
    INSERT INTO transactions (account_id, category_id, payee_id, amount_cents, date, board_id, gid)
      VALUES (1, 1, 1, -100000, '2026-11-01', 1, 'txn-gid');
  `);
}

const gidsOf = async (db: SQLiteDatabase, table: string, boardId: number) =>
  (await db.getAllAsync<{ gid: string }>(`SELECT gid FROM ${table} WHERE board_id = ? ORDER BY id`, boardId)).map(
    (r) => r.gid,
  );

async function withoutGids(bytes: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  for (const name of Object.keys(zip.files)) {
    const parsed = JSON.parse(await zip.file(name)!.async('string'));
    const strip = (o: Record<string, unknown>) => {
      delete o.gid;
      delete o.boardGid;
      return o;
    };
    zip.file(name, JSON.stringify(Array.isArray(parsed) ? parsed.map(strip) : strip(parsed)));
  }
  return zip.generateAsync({ type: 'uint8array' });
}

let source: SQLiteDatabase;
let zipBytes: Uint8Array;

beforeEach(async () => {
  source = await freshDb('source.db');
  await seedBoard(source);
  zipBytes = await buildBackupZip(source, 1, 'Home');
});

it('keeps gids when restoring onto another install, and resets its sync state', async () => {
  const target = await freshDb('target.db');
  await setMeta(target, 'device', 'old-device');
  const { boardId } = await importAppExport(target, await parseBackupZip(zipBytes), { keepName: true });

  expect((await target.getFirstAsync<{ gid: string }>('SELECT gid FROM boards WHERE id = ?', boardId))!.gid).toBe(
    'board-gid',
  );
  expect(await gidsOf(target, 'accounts', boardId)).toEqual(['acct-gid']);
  expect(await gidsOf(target, 'categories', boardId)).toEqual(['cat-gid']);
  expect(await gidsOf(target, 'payees', boardId)).toEqual(['payee-gid']);
  expect(await gidsOf(target, 'transactions', boardId)).toEqual(['txn-gid']);
  expect(await gidsOf(target, 'budget_entries', boardId)).toEqual([budgetEntryGid('cat-gid', '2026-11')]);
  expect(await getMeta(target, 'device')).toBeNull();
});

it('mints gids for a backup written before gids existed', async () => {
  const target = await freshDb('old-zip.db');
  const { boardId } = await importAppExport(target, await parseBackupZip(await withoutGids(zipBytes)));

  const [account] = await gidsOf(target, 'accounts', boardId);
  const [category] = await gidsOf(target, 'categories', boardId);
  expect(account).toMatch(UUID_V4);
  expect(category).toMatch(UUID_V4);
  expect((await gidsOf(target, 'transactions', boardId))[0]).toMatch(UUID_V4);
  expect(await gidsOf(target, 'budget_entries', boardId)).toEqual([budgetEntryGid(category, '2026-11')]);
});

it('mints a fresh identity for a board restored next to its original, FKs intact', async () => {
  await setMeta(source, 'device', 'this-device');
  const { boardId } = await importAppExport(source, await parseBackupZip(zipBytes));

  const all = await source.getAllAsync<{ gid: string }>(
    `SELECT gid FROM accounts UNION ALL SELECT gid FROM categories UNION ALL SELECT gid FROM payees
     UNION ALL SELECT gid FROM transactions UNION ALL SELECT gid FROM budget_entries UNION ALL SELECT gid FROM boards`,
  );
  expect(new Set(all.map((r) => r.gid)).size).toBe(all.length);

  const [category] = await gidsOf(source, 'categories', boardId);
  expect(category).toMatch(UUID_V4);
  expect(await gidsOf(source, 'budget_entries', boardId)).toEqual([budgetEntryGid(category, '2026-11')]);

  const txn = await source.getFirstAsync<{ a: number; c: number; p: number }>(
    `SELECT a.board_id AS a, c.board_id AS c, p.board_id AS p FROM transactions t
     JOIN accounts a ON a.id = t.account_id JOIN categories c ON c.id = t.category_id JOIN payees p ON p.id = t.payee_id
     WHERE t.board_id = ?`,
    boardId,
  );
  expect(txn).toEqual({ a: boardId, c: boardId, p: boardId });
  expect(await getMeta(source, 'device')).toBe('this-device');
});
