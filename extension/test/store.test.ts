import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Change } from '../../sync-core/merge';
import type { Scalar } from '../../sync-core/types';
import { Store } from '../src/store/store';

let store: Store;
let n = 0;

beforeEach(async () => {
  store = await Store.open(`test-${n++}`);
});
afterEach(() => store.close());

const live = (e: string, id: string, row: Record<string, Scalar>): Change => ({ e, id, status: 'live', row });
const tx = (id: string, board: string, account: string, date: string): Change =>
  live('transactions', id, { board_id: board, account_id: account, date, amount_cents: -100, memo: null });

describe('rows', () => {
  it('puts live rows and drops every other status', async () => {
    await store.applyPulled([tx('t1', 'b1', 'a1', '2026-11-01')], [], {});
    expect((await store.get('transactions', 't1'))?.row.amount_cents).toBe(-100);

    for (const status of ['deleted', 'alias', 'parked', 'hidden', 'absent'] as const) {
      await store.applyPulled([tx('t1', 'b1', 'a1', '2026-11-01')], [], {});
      await store.applyPulled([{ e: 'transactions', id: 't1', status, row: null }], [], {});
      expect(await store.get('transactions', 't1')).toBeUndefined();
    }
  });

  it('indexes only the fields a row has', async () => {
    await store.applyPulled([live('boards', 'b1', { name: 'Home', created_at: 'x' })], [], {});
    const b = await store.get('boards', 'b1');
    expect(b).toMatchObject({ k: 'boards/b1', e: 'boards', id: 'b1' });
    expect(b?.b).toBeUndefined();
    expect(b?.t).toBeUndefined();
  });
});

describe('page queries', () => {
  beforeEach(async () => {
    await store.applyPulled(
      [
        live('boards', 'b1', { name: 'Home' }),
        live('boards', 'b2', { name: 'Work' }),
        live('accounts', 'a1', { board_id: 'b1', name: 'Chequing' }),
        live('accounts', 'a2', { board_id: 'b1', name: 'Visa' }),
        live('accounts', 'a3', { board_id: 'b2', name: 'Other' }),
        live('category_groups', 'g1', { board_id: 'b1', name: 'Bills' }),
        live('categories', 'c1', { board_id: 'b1', group_id: 'g1', name: 'Rent' }),
        live('categories', 'c2', { board_id: 'b1', group_id: 'g2', name: 'Fun' }),
        live('budget_entries', 'e1', { board_id: 'b1', category_id: 'c1', month: '2026-11', assigned_cents: 1 }),
        live('budget_entries', 'e2', { board_id: 'b1', category_id: 'c1', month: '2026-10', assigned_cents: 2 }),
        tx('t1', 'b1', 'a1', '2026-10-30'),
        tx('t2', 'b1', 'a1', '2026-11-02'),
        tx('t3', 'b1', 'a2', '2026-11-02'),
        tx('t4', 'b1', 'a2', '2026-11-05'),
        tx('t5', 'b2', 'a3', '2026-11-03'),
      ],
      [],
      {},
    );
  });

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it('boards', async () => {
    expect(ids(await store.boards())).toEqual(['b1', 'b2']);
  });

  it('accounts by board', async () => {
    expect(ids(await store.accountsByBoard('b1'))).toEqual(['a1', 'a2']);
  });

  it('categories by group, not by name or board alone', async () => {
    expect(ids(await store.categoriesByGroup('g1'))).toEqual(['c1']);
  });

  it('budget entries by board and month', async () => {
    expect(ids(await store.budgetEntries('b1', '2026-11'))).toEqual(['e1']);
  });

  it('transactions by board, newest first, paged without gaps or repeats', async () => {
    const first = await store.transactionsByBoard('b1', 2);
    expect(ids(first)).toEqual(['t4', 't3']);
    const last = first[first.length - 1];
    const second = await store.transactionsByBoard('b1', 2, { date: last.t!, k: last.k });
    expect(ids(second)).toEqual(['t2', 't1']);
    const rest = await store.transactionsByBoard('b1', 2, { date: second[1].t!, k: second[1].k });
    expect(rest).toEqual([]);
  });

  it('transactions by account', async () => {
    expect(ids(await store.transactionsByAccount('a2', 10))).toEqual(['t4', 't3']);
  });

  it('transactions in a date range', async () => {
    expect(ids(await store.transactionsInRange('b1', '2026-11-01', '2026-11-30'))).toEqual(['t2', 't3', 't4']);
  });
});

describe('outbox and sealing', () => {
  it('commits the row and its group together', async () => {
    const group = [{ h: '0000000000001-0000', e: 'transactions', id: 't1', o: 'add' as const, x: { amount_cents: -100 } }];
    const id = await store.commitLocal([tx('t1', 'b1', 'a1', '2026-11-01')], group, { hlc: '0000000000001-0000' });
    expect(await store.outbox()).toEqual([{ id, group }]);
    expect(await store.get('transactions', 't1')).toBeDefined();
    expect(await store.getMeta('hlc')).toBe('0000000000001-0000');
  });

  it('rolls both back when the transaction aborts', async () => {
    const bad = { e: 'transactions', id: 't1', status: 'live', row: { date: () => 0 } } as unknown as Change;
    const group = [{ h: '0000000000001-0000', e: 'transactions', id: 't1', o: 'add' as const }];
    await expect(store.commitLocal([bad], group)).rejects.toBeTruthy();
    expect(await store.outbox()).toEqual([]);
    expect(await store.get('transactions', 't1')).toBeUndefined();
  });

  it('moves outbox groups into one sealed segment atomically', async () => {
    const g = (id: string) => [{ h: '0000000000001-0000', e: 'payees', id, o: 'add' as const }];
    const a = await store.commitLocal([], g('p1'));
    const b = await store.commitLocal([], g('p2'));
    const bytes = new Uint8Array([1, 2, 3]);
    await store.seal([a, b], { seq: 1, key: 'sync/log/d/000000000001.ndjson.gz', bytes }, { nextSeq: 2 });
    expect(await store.outbox()).toEqual([]);
    const sealed = await store.sealed();
    expect(sealed).toHaveLength(1);
    expect([...sealed[0].bytes]).toEqual([1, 2, 3]);
    expect(await store.getMeta('nextSeq')).toBe(2);
    await store.markSent(1);
    expect(await store.sealed()).toEqual([]);
  });
});

describe('merge state', () => {
  it('round-trips checkpoint lines and the header', async () => {
    const line = { e: 'payees', id: 'p1', exists: true, f: { name: { x: 'Costco', s: 'h@d' } }, heads: {} };
    const header = { v: 1, d: 'd', h: '0000000000001-0000', vv: { d: 3 } };
    await store.applyPulled([], [line], { stateHeader: header, applied: { d: { seq: 3, lastKey: 'k' } } });
    expect(await store.loadState()).toEqual({ header, lines: [line] });
    expect(await store.getMeta('applied')).toEqual({ d: { seq: 3, lastKey: 'k' } });
  });

  it('clear wipes everything', async () => {
    await store.setMeta({ device: 'd' });
    await store.applyPulled([tx('t1', 'b1', 'a1', '2026-11-01')], [], {});
    await store.clear();
    expect(await store.getMeta('device')).toBeUndefined();
    expect(await store.get('transactions', 't1')).toBeUndefined();
  });
});
