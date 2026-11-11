import type { Change } from '../../../sync-core/merge';
import type { CheckpointEntity, CheckpointHeader, Group, Scalar } from '../../../sync-core/types';
import { collect, request, tx } from './idb';

// Materialised ledger + sync bookkeeping for one browser profile.
//
// rows     `<e>/<gid>` → live row, FKs already gids (merge `changes()`).
//          Index fields are copied out of the row only where they apply, and
//          IndexedDB leaves a record out of an index whose key is missing, so
//          each index holds just the entity it serves.
// state    `<e>/<gid>` → checkpoint line; reopening skips the download.
// outbox   auto id → one local group, not yet sealed.
// sealed   seq → segment bytes, sealed and not yet sent.
// meta     key → value (see Meta).

export interface StoredRow {
  k: string;
  e: string;
  id: string;
  row: Record<string, Scalar>;
  b?: string; // board_id
  a?: string; // account_id
  g?: string; // group_id
  t?: string; // date
  m?: string; // month
}

export interface Applied {
  seq: number;
  lastKey: string;
}

export type Fatal = { kind: 'collision' | 'newer' | 'clock' | 'auth'; detail: string; at: number };

export interface Meta {
  device: string;
  hlc: string;
  offset: number;
  nextSeq: number;
  applied: Record<string, Applied>;
  stateHeader: CheckpointHeader;
  fatal: Fatal | null;
  // Bucket ms the device file was first written / last refreshed.
  deviceCreated: number;
  deviceSeen: number;
}

export interface Sealed {
  seq: number;
  key: string;
  bytes: Uint8Array;
}

export interface OutboxEntry {
  id: number;
  group: Group;
}

// Cursor for the next page of a newest-first transaction list.
export interface PageAfter {
  date: string;
  k: string;
}

const STORES = ['rows', 'state', 'outbox', 'sealed', 'meta'];
const HIGH = '￿';

const keyOf = (e: string, id: string) => `${e}/${id}`;

const str = (v: Scalar | undefined): string | undefined => (typeof v === 'string' ? v : undefined);

export function toStored(c: Change): StoredRow {
  const row = c.row!;
  const out: StoredRow = { k: keyOf(c.e, c.id), e: c.e, id: c.id, row };
  const fields: [keyof StoredRow, string][] = [
    ['b', 'board_id'],
    ['a', 'account_id'],
    ['g', 'group_id'],
    ['t', 'date'],
    ['m', 'month'],
  ];
  for (const [ix, f] of fields) {
    const v = str(row[f]);
    if (v !== undefined) (out as unknown as Record<string, string>)[ix] = v;
  }
  return out;
}

export const openDb = (name = 'budgets-bro'): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const rows = db.createObjectStore('rows', { keyPath: 'k' });
      rows.createIndex('board', ['e', 'b']);
      rows.createIndex('boardDate', ['e', 'b', 't', 'k']);
      rows.createIndex('accountDate', ['e', 'a', 't', 'k']);
      rows.createIndex('boardMonth', ['e', 'b', 'm']);
      rows.createIndex('group', ['e', 'g']);
      db.createObjectStore('state');
      db.createObjectStore('outbox', { autoIncrement: true });
      db.createObjectStore('sealed');
      db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function writeChanges(t: IDBTransaction, changes: Iterable<Change>): void {
  const rows = t.objectStore('rows');
  for (const c of changes) {
    if (c.status === 'live' && c.row) rows.put(toStored(c));
    else rows.delete(keyOf(c.e, c.id));
  }
}

function writeLines(t: IDBTransaction, lines: Iterable<CheckpointEntity>): void {
  const state = t.objectStore('state');
  for (const line of lines) state.put(line, keyOf(line.e, line.id));
}

function writeMeta(t: IDBTransaction, meta: Partial<Meta>): void {
  const store = t.objectStore('meta');
  for (const [k, v] of Object.entries(meta)) store.put(v, k);
}

export class Store {
  private constructor(readonly db: IDBDatabase) {}

  static async open(name?: string): Promise<Store> {
    return new Store(await openDb(name));
  }

  close(): void {
    this.db.close();
  }

  // ── writes ────────────────────────────────────────────────────────────

  // A local edit: its rows and its outbox group land together or not at all.
  async commitLocal(
    changes: Change[],
    group: Group,
    meta: Partial<Meta> = {},
    lines: Iterable<CheckpointEntity> = [],
  ): Promise<number> {
    let id = 0;
    await tx(this.db, ['rows', 'state', 'outbox', 'meta'], 'readwrite', (t) => {
      writeChanges(t, changes);
      writeLines(t, lines);
      const r = t.objectStore('outbox').add(group);
      r.onsuccess = () => (id = r.result as number);
      writeMeta(t, meta);
    });
    return id;
  }

  // A pull: materialised rows, the merge-state lines it touched and the new
  // applied/vv meta in one transaction, so a crash reapplies the pull whole.
  async applyPulled(changes: Change[], lines: Iterable<CheckpointEntity>, meta: Partial<Meta>): Promise<void> {
    await tx(this.db, ['rows', 'state', 'meta'], 'readwrite', (t) => {
      writeChanges(t, changes);
      writeLines(t, lines);
      writeMeta(t, meta);
    });
  }

  // Outbox groups become sealed segments, atomically, with whatever the
  // merge state learned from sealing them (their real seq, the own vv).
  async seal(
    outboxIds: number[],
    segments: Sealed | Sealed[],
    meta: Partial<Meta> = {},
    changes: Change[] = [],
    lines: Iterable<CheckpointEntity> = [],
  ): Promise<void> {
    await tx(this.db, ['rows', 'state', 'outbox', 'sealed', 'meta'], 'readwrite', (t) => {
      const outbox = t.objectStore('outbox');
      for (const id of outboxIds) outbox.delete(id);
      const sealed = t.objectStore('sealed');
      for (const s of Array.isArray(segments) ? segments : [segments]) sealed.put(s, s.seq);
      writeChanges(t, changes);
      writeLines(t, lines);
      writeMeta(t, meta);
    });
  }

  async markSent(seq: number): Promise<void> {
    await tx(this.db, ['sealed'], 'readwrite', (t) => t.objectStore('sealed').delete(seq));
  }

  async setMeta(meta: Partial<Meta>): Promise<void> {
    await tx(this.db, ['meta'], 'readwrite', (t) => writeMeta(t, meta));
  }

  // New bucket or a fatal reset: everything goes, the device id included.
  async clear(): Promise<void> {
    await tx(this.db, STORES, 'readwrite', (t) => {
      for (const s of STORES) t.objectStore(s).clear();
    });
  }

  // ── sync reads ────────────────────────────────────────────────────────

  async getMeta<K extends keyof Meta>(key: K): Promise<Meta[K] | undefined> {
    const t = this.db.transaction('meta', 'readonly');
    return (await request(t.objectStore('meta').get(key))) as Meta[K] | undefined;
  }

  async outbox(): Promise<OutboxEntry[]> {
    const store = this.db.transaction('outbox', 'readonly').objectStore('outbox');
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
    return keys.map((k, i) => ({ id: k as number, group: values[i] as Group }));
  }

  async sealed(): Promise<Sealed[]> {
    const store = this.db.transaction('sealed', 'readonly').objectStore('sealed');
    return (await request(store.getAll())) as Sealed[];
  }

  // Whole merge state, read once when the page opens a sync session.
  async loadState(): Promise<{ header: CheckpointHeader | undefined; lines: CheckpointEntity[] }> {
    const t = this.db.transaction(['state', 'meta'], 'readonly');
    const [header, lines] = await Promise.all([
      request(t.objectStore('meta').get('stateHeader')),
      request(t.objectStore('state').getAll()),
    ]);
    return { header: header as CheckpointHeader | undefined, lines: lines as CheckpointEntity[] };
  }

  // ── page reads (each one index range, never a scan) ───────────────────

  async get(e: string, id: string): Promise<StoredRow | undefined> {
    const t = this.db.transaction('rows', 'readonly');
    return (await request(t.objectStore('rows').get(keyOf(e, id)))) as StoredRow | undefined;
  }

  private index(name: string): IDBIndex {
    return this.db.transaction('rows', 'readonly').objectStore('rows').index(name);
  }

  // Every row of one entity, by primary-key prefix. For small tables only.
  all(e: string): Promise<StoredRow[]> {
    const store = this.db.transaction('rows', 'readonly').objectStore('rows');
    return collect(store, IDBKeyRange.bound(`${e}/`, `${e}/${HIGH}`));
  }

  boards(): Promise<StoredRow[]> {
    return this.all('boards');
  }

  // Any board-scoped entity: accounts, category_groups, payees, …
  byBoard(e: string, board: string): Promise<StoredRow[]> {
    return collect(this.index('board'), IDBKeyRange.only([e, board]));
  }

  accountsByBoard(board: string): Promise<StoredRow[]> {
    return this.byBoard('accounts', board);
  }

  categoriesByGroup(group: string): Promise<StoredRow[]> {
    return collect(this.index('group'), IDBKeyRange.only(['categories', group]));
  }

  budgetEntries(board: string, month: string): Promise<StoredRow[]> {
    return collect(this.index('boardMonth'), IDBKeyRange.only(['budget_entries', board, month]));
  }

  // Newest first, `limit` per page; pass the last row's {date, k} for the next.
  transactionsByBoard(board: string, limit: number, after?: PageAfter): Promise<StoredRow[]> {
    return this.page('boardDate', board, limit, after);
  }

  transactionsByAccount(account: string, limit: number, after?: PageAfter): Promise<StoredRow[]> {
    return this.page('accountDate', account, limit, after);
  }

  // Inclusive date range, oldest first: a month's activity, or everything up
  // to a month for running balances.
  transactionsInRange(board: string, from: string, to: string): Promise<StoredRow[]> {
    return collect(
      this.index('boardDate'),
      IDBKeyRange.bound(['transactions', board, from, ''], ['transactions', board, to, HIGH]),
    );
  }

  private page(index: string, scope: string, limit: number, after?: PageAfter): Promise<StoredRow[]> {
    const lower = ['transactions', scope, '', ''];
    const range = after
      ? IDBKeyRange.bound(lower, ['transactions', scope, after.date, after.k], false, true)
      : IDBKeyRange.bound(lower, ['transactions', scope, HIGH, HIGH]);
    return collect(this.index(index), range, 'prev', limit);
  }
}
