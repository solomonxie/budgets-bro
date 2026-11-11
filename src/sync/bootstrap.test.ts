/**
 * @jest-environment node
 */
import { openDatabase } from '../db/driver';
import type { SQLiteDatabase } from '../db/driver';
import { migrate } from '../db/migrate';
import * as syncState from '../db/repositories/syncStateRepo';
import type { Bucket, ListedObject, PutOnceResult } from '../../sync-core/bucket';
import { decodeCheckpoint, decodeSegment } from '../../sync-core/codec';
import { syncedColumns } from '../../sync-core/columns';
import { entities } from '../../sync-core/entities';
import { SyncState } from '../../sync-core/merge';
import { buildBackupZip } from './buildBackup';
import { parseBackupZip } from './parseBackupZip';
import { importAppExport } from '../import/appExportImporter';
import { ORDER, forgetState, pull } from './apply';
import { ensureBootstrapped } from './bootstrap';
import { gzip } from './gzip';
import { buildOutbox } from './outbox';
import { push } from './push';

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
jest.mock('../db/client', () => ({ isDemoMode: async () => false }));

const NOW = 1_800_000_000_000;
const now = () => NOW;

class FakeBucket implements Bucket {
  objects = new Map<string, Uint8Array>();
  async list(prefix: string, opts: { startAfter?: string } = {}): Promise<ListedObject[]> {
    return [...this.objects.keys()]
      .filter((k) => k.startsWith(prefix) && (!opts.startAfter || k > opts.startAfter))
      .sort()
      .map((key) => ({ key, size: 0, etag: '', lastModified: NOW }));
  }
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
  async head() {
    return null;
  }
  async put(key: string, bytes: Uint8Array) {
    this.objects.set(key, bytes);
  }
  async putOnce(key: string, bytes: Uint8Array): Promise<PutOnceResult> {
    const existing = this.objects.get(key);
    if (existing) return Buffer.compare(existing, bytes) === 0 ? 'landed' : 'collision';
    this.objects.set(key, bytes);
    return 'written';
  }
}

let n = 0;
async function freshDb(): Promise<SQLiteDatabase> {
  const db = openDatabase(`boot${n++}.db`, '/documents/SQLite');
  await migrate(db);
  return db;
}

async function seed(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    INSERT INTO accounts (id, name, type, board_id, gid) VALUES (1, 'Chequing', 'cash', 1, 'acct-a');
    INSERT INTO accounts (id, name, type, board_id, gid) VALUES (2, 'Savings', 'savings', 1, 'acct-b');
    INSERT INTO category_groups (id, name, board_id, gid) VALUES (1, 'Bills', 1, 'group-a');
    INSERT INTO categories (id, group_id, name, board_id, linked_account_id, gid) VALUES (1, 1, 'Rent', 1, 2, 'cat-a');
    UPDATE accounts SET loan_payment_category_id = 1 WHERE id = 2;
    INSERT INTO payees (id, name, board_id, gid) VALUES (1, 'Landlord', 1, 'payee-a');
    INSERT INTO transactions (id, account_id, category_id, payee_id, amount_cents, date, memo, board_id, gid)
      VALUES (1, 1, 1, 1, -100000, '2026-11-01', 'November', 1, 'txn-a');
    INSERT INTO transactions (id, account_id, transfer_account_id, amount_cents, date, board_id, gid)
      VALUES (2, 1, 2, -5000, '2026-11-02', 1, 'txn-b');
  `);
  // A row from a build that had 046 but not gid-on-insert.
  await db.execAsync(`
    INSERT INTO transactions (id, account_id, amount_cents, date, board_id) VALUES (3, 1, -700, '2026-11-03', 1);
    INSERT INTO budget_entries (category_id, month, assigned_cents, board_id) VALUES (1, '2026-11', 100000, 1);
  `);
}

const deviceOf = async (db: SQLiteDatabase) => (await syncState.getMeta(db, 'device'))!;

// Every synced table as `<e>/<gid>` → synced values, FKs as gids.
async function ledger(db: SQLiteDatabase): Promise<Map<string, Record<string, unknown>>> {
  const gidById = new Map<string, string>();
  for (const t of ORDER) {
    for (const r of await db.getAllAsync<{ id: number; gid: string }>(`SELECT id, gid FROM ${t}`)) {
      gidById.set(`${t}/${r.id}`, r.gid);
    }
  }
  const out = new Map<string, Record<string, unknown>>();
  for (const t of ORDER) {
    for (const r of await db.getAllAsync<Record<string, unknown> & { gid: string }>(`SELECT * FROM ${t}`)) {
      const row: Record<string, unknown> = {};
      for (const f of syncedColumns[t]) {
        const fk = entities[t].fks[f];
        row[f] = fk && r[f] != null ? gidById.get(`${fk.to}/${r[f]}`) : (r[f] ?? null);
      }
      out.set(`${t}/${r.gid}`, row);
    }
  }
  return out;
}

async function stateRows(state: SyncState): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const c of state.changes()) if (c.status === 'live') out.set(`${c.e}/${c.id}`, c.row!);
  return out;
}

describe('ensureBootstrapped', () => {
  it('publishes every row and a checkpoint a fresh device can load', async () => {
    const db = await freshDb();
    await seed(db);
    const bucket = new FakeBucket();

    expect(await ensureBootstrapped(db, bucket, { now })).toBe('done');
    const device = await deviceOf(db);
    expect([...bucket.objects.keys()].some((k) => k.startsWith(`sync/log/${device}/`))).toBe(true);
    expect(await syncState.listSealed(db)).toEqual([]);

    const cpKey = [...bucket.objects.keys()].find((k) => k.startsWith(`sync/checkpoints/${device}/`))!;
    const cp = await decodeCheckpoint(gzip, bucket.objects.get(cpKey)!);
    const loaded = SyncState.fromCheckpoint(cp.header, cp.entities);
    expect(await stateRows(loaded)).toEqual(await ledger(db));
    expect(cp.header.vv[device]).toBeGreaterThan(0);

    const nullGids = await db.getFirstAsync<{ n: number }>(
      'SELECT (SELECT count(*) FROM transactions WHERE gid IS NULL) + (SELECT count(*) FROM budget_entries WHERE gid IS NULL) AS n',
    );
    expect(nullGids?.n).toBe(0);
    // History isn't resent, and a second call is a no-op.
    expect(await buildOutbox(db, now)).toBeNull();
    expect(await ensureBootstrapped(db, bucket, { now })).toBe('already');
  });

  it('joins with a restored backup: shared gids keep cloud values, only new rows are sent', async () => {
    const bucket = new FakeBucket();
    const a = await freshDb();
    await seed(a);
    const zip = await buildBackupZip(a, 1, 'Home');
    expect(await ensureBootstrapped(a, bucket, { now })).toBe('done');

    // A edits after the backup was taken; the cloud has the newer memo.
    await a.runAsync(`UPDATE transactions SET memo = 'November rent' WHERE gid = 'txn-a'`);
    await push({ db: a, bucket, gzip, now, deviceName: 'A' });

    const b = await freshDb();
    const { boardId } = await importAppExport(b, await parseBackupZip(zip), { keepName: true });
    await b.runAsync(`INSERT INTO accounts (name, type, board_id, gid) VALUES ('Visa', 'credit_card', ?, 'acct-new')`, boardId);
    expect(await ensureBootstrapped(b, bucket, { now })).toBe('joined');

    const memo = await b.getFirstAsync<{ memo: string }>(`SELECT memo FROM transactions WHERE gid = 'txn-a'`);
    expect(memo?.memo).toBe('November rent');

    // B's segments carry only what the cloud lacked: its own default board and the new account.
    const bDevice = await deviceOf(b);
    const sent = new SyncState();
    for (const key of [...bucket.objects.keys()].filter((k) => k.startsWith(`sync/log/${bDevice}/`)).sort()) {
      sent.applySegment(await decodeSegment(gzip, bucket.objects.get(key)!, NOW));
    }
    const sentKeys = [...sent.entities.keys()];
    expect(sentKeys).toContain('accounts/acct-new');
    expect(sentKeys.filter((k) => k.endsWith('-a') || k.endsWith('-b'))).toEqual([]);

    // A pulls B and converges on the same rows for the shared board.
    forgetState(a);
    await pull({ db: a, bucket, gzip, device: await deviceOf(a), now });
    const la = await ledger(a);
    const lb = await ledger(b);
    for (const [k, row] of la) expect(lb.get(k)).toEqual(row);
    expect(la.has('accounts/acct-new')).toBe(true);
  });

  it('never deletes local rows the cloud lacks', async () => {
    const bucket = new FakeBucket();
    const a = await freshDb();
    expect(await ensureBootstrapped(a, bucket, { now })).toBe('done');

    const b = await freshDb();
    await seed(b);
    const before = await ledger(b);
    expect(await ensureBootstrapped(b, bucket, { now })).toBe('joined');
    const after = await ledger(b);
    // Rows without a gid get one, so compare those by count.
    expect([...before.keys()].filter((k) => !k.endsWith('/null') && !after.has(k))).toEqual([]);
    // Plus A's default board, which B now has too.
    expect(after.size).toBe(before.size + 1);
  });

  it('resumes a bootstrap interrupted after sealing', async () => {
    const db = await freshDb();
    await seed(db);
    const bucket = new FakeBucket();
    const device = () => deviceOf(db);
    // Fail the own-log read that follows sealing.
    const realList = bucket.list.bind(bucket);
    let armed = true;
    bucket.list = async (prefix, opts) => {
      if (armed && prefix === `sync/log/${await device()}/`) {
        armed = false;
        throw new Error('network');
      }
      return realList(prefix, opts);
    };

    await expect(ensureBootstrapped(db, bucket, { now })).rejects.toThrow('network');
    expect(await syncState.getMeta(db, 'bootstrap')).toBe('sealed');
    const sealed = (await syncState.listSealed(db)).length;
    expect(sealed).toBeGreaterThan(0);

    expect(await ensureBootstrapped(db, bucket, { now })).toBe('done');
    const prefix = `sync/log/${await device()}/`;
    const segs = [...bucket.objects.keys()].filter((k) => k.startsWith(prefix));
    expect(segs).toHaveLength(sealed);
    expect([...bucket.objects.keys()].some((k) => k.startsWith('sync/checkpoints/'))).toBe(true);
  });

  it('bootstraps a 50k-transaction ledger', async () => {
    const db = await freshDb();
    await seed(db);
    await db.withTransactionAsync(async () => {
      for (let i = 0; i < 50_000; i++) {
        await db.runAsync(
          `INSERT INTO transactions (account_id, category_id, payee_id, amount_cents, date, memo, board_id, gid)
           VALUES (1, 1, 1, ?, '2026-10-15', 'bulk', 1, ?)`,
          -i,
          `bulk-${i}`,
        );
      }
    });
    const started = performance.now();
    expect(await ensureBootstrapped(db, new FakeBucket(), { now })).toBe('done');
    const ms = performance.now() - started;
    console.log(`bootstrap of 50k transactions: ${Math.round(ms)} ms`);
    expect(ms).toBeLessThan(60_000);
  }, 120_000);
});
