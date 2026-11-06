import { budgetEntryGid } from './entities';
import { SyncState } from './merge';
import type { Op, Scalar, Segment, VersionVector, WireOp } from './types';

const T0 = 1_793_414_025_000;
const h = (ms: number, c = 0) => `${String(T0 + ms).padStart(13, '0')}-${String(c).padStart(4, '0')}`;

const seg = (d: string, seq: number, vv: VersionVector, ops: WireOp[], lastModified = T0 + 10_000_000): Segment => ({
  d,
  seq,
  vv,
  lastModified,
  ops: ops.map((o): Op => ({ ...o, d, seq, vv })),
});

const add = (hl: string, e: string, id: string, x: Record<string, Scalar>): WireOp => ({
  h: hl,
  e,
  id,
  o: 'add',
  x: { deleted: null, ...x },
});
const set = (hl: string, e: string, id: string, f: string, x: Scalar): WireOp => ({ h: hl, e, id, o: 'set', f, x });

// Every interleaving that keeps each device's seq order.
function interleavings(byDevice: Segment[][]): Segment[][] {
  if (byDevice.every((l) => l.length === 0)) return [[]];
  const out: Segment[][] = [];
  byDevice.forEach((list, i) => {
    if (!list.length) return;
    const rest = byDevice.map((l, j) => (j === i ? l.slice(1) : l));
    for (const tail of interleavings(rest)) out.push([list[0]!, ...tail]);
  });
  return out;
}

interface Snapshot {
  fields: Record<string, Record<string, Scalar>>;
  conflicts: unknown;
  aliases: Record<string, string>;
  hidden: string[];
  store: Record<string, Record<string, Scalar>>;
}

// Applies segments one at a time, writing changes() into a store after each,
// as an applier would, so incremental materialisation is checked too.
function run(order: Segment[]): Snapshot {
  const s = new SyncState();
  const store: Record<string, Record<string, Scalar>> = {};
  const drain = () => {
    for (const c of s.changes()) {
      const key = `${c.e}/${c.id}`;
      if (c.row) store[key] = c.row;
      else delete store[key];
    }
  };
  for (const g of order) {
    // A pull that hits a gap stops; the segment comes round again later.
    s.applySegment(g);
    s.applySegment(g);
    drain();
  }
  const fields: Snapshot['fields'] = {};
  for (const ent of s.listed()) {
    fields[`${ent.e}/${ent.id}`] = Object.fromEntries([...ent.fields].map(([f, v]) => [f, v.x]));
  }
  return { fields, conflicts: s.conflicts(), aliases: s.aliases(), hidden: s.hidden(), store };
}

function converge(byDevice: Segment[][]): Snapshot {
  const runs = interleavings(byDevice).map(run);
  for (const r of runs) expect(r).toEqual(runs[0]);
  return runs[0]!;
}

const B = 'b0';
const board = add(h(0), 'boards', B, { name: 'Home' });
const acct = (id: string, ms = 1) => add(h(ms), 'accounts', id, { board_id: B, name: id });

describe('merge', () => {
  it('per-field LWW converges in any order', () => {
    const r = converge([
      [seg('a', 1, {}, [board, acct('A1'), set(h(5), 'accounts', 'A1', 'sort_order', 1)])],
      [seg('b', 1, {}, [set(h(6), 'accounts', 'A1', 'sort_order', 2), set(h(4), 'accounts', 'A1', 'currency', 'CAD')])],
    ]);
    expect(r.fields['accounts/A1']).toMatchObject({ sort_order: 2, currency: 'CAD' });
  });

  it('keeps a concurrent text edit as a conflict; a resolving set clears it', () => {
    const base = seg('a', 1, {}, [board, acct('A1'), add(h(2), 'transactions', 'T1', { board_id: B, account_id: 'A1', memo: 'x' })]);
    const a2 = seg('a', 2, {}, [set(h(10), 'transactions', 'T1', 'memo', 'from a')]);
    const b1 = seg('b', 1, { a: 1 }, [set(h(11), 'transactions', 'T1', 'memo', 'from b')]);
    const r = converge([[base, a2], [b1]]);
    expect(r.fields['transactions/T1']!.memo).toBe('from b');
    expect(r.conflicts).toEqual([
      { e: 'transactions', id: 'T1', f: 'memo', x: 'from a', d: 'a', s: `${h(10)}@a` },
    ]);
    const a3 = seg('a', 3, { b: 1 }, [set(h(12), 'transactions', 'T1', 'memo', 'merged')]);
    expect(converge([[base, a2, a3], [b1]]).conflicts).toEqual([]);
  });

  it('a later edit that saw the earlier one is no conflict', () => {
    const base = seg('a', 1, {}, [board, acct('A1'), add(h(2), 'transactions', 'T1', { board_id: B, account_id: 'A1', memo: 'x' })]);
    const b1 = seg('b', 1, { a: 1 }, [set(h(11), 'transactions', 'T1', 'memo', 'b')]);
    expect(converge([[base], [b1]]).conflicts).toEqual([]);
  });

  it('delete is a field; undo re-adds the same gid', () => {
    const a1 = seg('a', 1, {}, [board, acct('A1')]);
    const a2 = seg('a', 2, {}, [set(h(5), 'accounts', 'A1', 'deleted', T0 + 5)]);
    expect(converge([[a1, a2]]).store['accounts/A1']).toBeUndefined();
    const a3 = seg('a', 3, {}, [add(h(6), 'accounts', 'A1', { board_id: B, name: 'A1' })]);
    expect(converge([[a1, a2, a3]]).store['accounts/A1']).toMatchObject({ name: 'A1' });
  });

  it('a group never ends up half from each device', () => {
    const legs = (hl: string, amt: number): WireOp[] => [
      set(hl, 'transactions', 'T1', 'amount_cents', -amt),
      set(hl, 'transactions', 'T2', 'amount_cents', amt),
    ];
    const base = seg('a', 1, {}, [
      board,
      acct('A1'),
      acct('A2'),
      add(h(2), 'transactions', 'T1', { board_id: B, account_id: 'A1', transfer_account_id: 'A2', amount_cents: -1 }),
      add(h(2), 'transactions', 'T2', { board_id: B, account_id: 'A2', transfer_account_id: 'A1', amount_cents: 1 }),
    ]);
    const r = converge([[base, seg('a', 2, {}, legs(h(10), 500))], [seg('b', 1, {}, legs(h(10), 700))]]);
    expect(r.fields['transactions/T1']!.amount_cents).toBe(-(r.fields['transactions/T2']!.amount_cents as number));
  });

  it('collapses duplicate payees onto the smallest gid and un-aliases on rename', () => {
    const base = seg('a', 1, {}, [board, acct('A1')]);
    const pa = seg('a', 2, {}, [
      add(h(3), 'payees', 'p2', { board_id: B, name: 'Costco' }),
      add(h(3), 'transactions', 'T1', { board_id: B, account_id: 'A1', payee_id: 'p2' }),
    ]);
    const pb = seg('b', 1, {}, [add(h(4), 'payees', 'p1', { board_id: B, name: 'Costco' })]);
    const r = converge([[base, pa], [pb]]);
    expect(r.aliases).toEqual({ 'payees/p2': 'payees/p1' });
    expect(r.store['payees/p2']).toBeUndefined();
    expect(r.store['transactions/T1']!.payee_id).toBe('p1');

    const rename = seg('a', 3, { b: 1 }, [set(h(9), 'payees', 'p2', 'name', 'Costco Gas')]);
    const r2 = converge([[base, pa, rename], [pb]]);
    expect(r2.aliases).toEqual({});
    expect(r2.store['transactions/T1']!.payee_id).toBe('p2');
  });

  it('parks a row until its FK target arrives', () => {
    const a1 = seg('a', 1, {}, [board]);
    const b1 = seg('b', 1, {}, [add(h(3), 'transactions', 'T1', { board_id: B, account_id: 'A1' })]);
    const r = converge([[a1], [b1]]);
    expect(r.hidden).toEqual(['transactions/T1']);
    expect(r.store['transactions/T1']).toBeUndefined();
    const r2 = converge([[a1, seg('a', 2, {}, [acct('A1', 5)])], [b1]]);
    expect(r2.hidden).toEqual([]);
    expect(r2.store['transactions/T1']).toMatchObject({ account_id: 'A1' });
  });

  it('nulls a nullable FK to a deleted target, hides a NOT NULL one', () => {
    const base = seg('a', 1, {}, [
      board,
      acct('A1'),
      add(h(2), 'category_groups', 'G1', { board_id: B, name: 'G' }),
      add(h(2), 'categories', 'C1', { board_id: B, group_id: 'G1', name: 'Food' }),
      add(h(3), 'transactions', 'T1', { board_id: B, account_id: 'A1', category_id: 'C1' }),
    ]);
    const delCat = seg('b', 1, { a: 1 }, [set(h(5), 'categories', 'C1', 'deleted', 1)]);
    const r = converge([[base], [delCat]]);
    expect(r.store['transactions/T1']!.category_id).toBeNull();

    const delAcct = seg('a', 2, {}, [set(h(6), 'accounts', 'A1', 'deleted', 1)]);
    const r2 = converge([[base, delAcct], [delCat]]);
    expect(r2.hidden).toEqual(['transactions/T1']);
    const undo = seg('a', 3, {}, [set(h(7), 'accounts', 'A1', 'deleted', null)]);
    const r3 = converge([[base, delAcct, undo], [delCat]]);
    expect(r3.hidden).toEqual([]);
    expect(r3.store['transactions/T1']).toMatchObject({ account_id: 'A1', category_id: null });
  });

  it('a reference cycle settles the same from either end', () => {
    const r = converge([
      [seg('a', 1, {}, [board, add(h(1), 'accounts', 'A1', { board_id: B, loan_payment_category_id: 'C1' })])],
      [seg('b', 1, {}, [add(h(2), 'categories', 'C1', { board_id: B, group_id: 'G1', linked_account_id: 'A1' })])],
    ]);
    expect(r.hidden).toEqual(['accounts/A1', 'categories/C1']);
  });

  it('ignores ops stamped over an hour past their segment', () => {
    const r = converge([[seg('a', 1, {}, [board, set(h(3_600_001), 'boards', B, 'name', 'Future')], T0)]]);
    expect(r.fields['boards/b0']!.name).toBe('Home');
  });

  it('a checkpoint plus the rest equals applying everything', () => {
    const a1 = seg('a', 1, {}, [board, acct('A1')]);
    const b1 = seg('b', 1, { a: 1 }, [set(h(9), 'accounts', 'A1', 'name', 'Chequing')]);
    const a2 = seg('a', 2, {}, [set(h(8), 'accounts', 'A1', 'name', 'Savings')]);
    const full = new SyncState();
    [a1, b1, a2].forEach((g) => full.applySegment(g));

    const part = new SyncState();
    [a1, b1].forEach((g) => part.applySegment(g));
    const loaded = SyncState.fromCheckpoint(
      JSON.parse(JSON.stringify(part.checkpointHeader('a', h(9)))),
      JSON.parse(JSON.stringify([...part.checkpointEntities()])),
    );
    loaded.applySegment(a2);
    expect([...loaded.checkpointEntities()]).toEqual([...full.checkpointEntities()]);
    expect(loaded.conflicts()).toEqual(full.conflicts());
    expect(loaded.changes().map((c) => c.row)).toEqual(full.changes().map((c) => c.row));
  });

  it('changes() hands out only what moved', () => {
    const s = new SyncState();
    s.applySegment(seg('a', 1, {}, [board, acct('A1'), acct('A2')]));
    expect(s.changes()).toHaveLength(3);
    s.applySegment(seg('a', 2, {}, [set(h(5), 'accounts', 'A2', 'name', 'x')]));
    expect(s.changes().map((c) => c.id)).toEqual(['A2']);
    s.applySegment(seg('a', 3, {}, [set(h(6), 'boards', B, 'deleted', 1)]));
    expect(s.changes().map((c) => [c.id, c.status])).toEqual([
      ['A1', 'hidden'],
      ['A2', 'hidden'],
      [B, 'deleted'],
    ]);
    expect(s.changes()).toEqual([]);
  });

  it('derives budget entry gids', () => {
    const g = budgetEntryGid('cat-1', '2026-11');
    expect(g).toMatch(/^be:[0-9a-f]{32}$/);
    expect(budgetEntryGid('cat-1', '2026-11')).toBe(g);
    expect(budgetEntryGid('cat-1', '2026-12')).not.toBe(g);
  });
});
