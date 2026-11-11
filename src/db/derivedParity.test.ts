/**
 * @jest-environment node
 */
import { openDatabase } from './driver';
import type { SQLiteDatabase } from './driver';
import { migrate } from './migrate';
import { seedDemoBoard } from './seed/demoBoard';
import * as budgetsRepo from './repositories/budgetsRepo';
import * as accountsRepo from './repositories/accountsRepo';
import * as categoriesRepo from './repositories/categoriesRepo';
import { currentDateISO, currentMonth, lastNMonths, nextMonth } from '../domain/month';
import {
  categoryBalanceCents,
  categoryCaption,
  categoryFundedCents,
  categoryStatus,
} from '../domain/budgetMath';
import { accountBalances, categoryFigures, unassignedBreakdown } from '../../sync-core/derived';
import type { AccountRec, EntryRec, RateRec, TxnRec, ValueRec } from '../../sync-core/derived';

// The extension computes from rows what the phone computes in SQL. Same
// board, both paths, every figure the Budget and Accounts screens show.

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
jest.mock('./preMigrationSnapshot', () => ({ takeSnapshot: async () => {} }));

let db: SQLiteDatabase;
let boardId: number;

const plusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

async function edgeCases(): Promise<void> {
  const today = currentDateISO();
  const month = currentMonth();
  const cat = (await db.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE board_id = ? ORDER BY id LIMIT 1', boardId))!.id;
  const cashId = (await db.getFirstAsync<{ id: number }>("SELECT id FROM accounts WHERE board_id = ? AND type = 'cash'", boardId))!.id;
  const trackingId = (await db.getFirstAsync<{ id: number }>("SELECT id FROM accounts WHERE board_id = ? AND type = 'tracking'", boardId))!.id;
  const txn = (account: number, category: number | null, cents: number, date: string) =>
    db.runAsync(
      'INSERT INTO transactions (board_id, account_id, category_id, amount_cents, date) VALUES (?, ?, ?, ?, ?)',
      boardId, account, category, cents, date,
    );
  // Overspent this month, and a future-dated spend that must not count yet.
  await txn(cashId, cat, -99999999, today);
  await txn(cashId, cat, -5000, plusDays(today, 3));
  // Categorised on an off-budget account: never counts as spent.
  await txn(trackingId, cat, -777, today);
  // A closed cash account still spends from its category but leaves the cash side.
  const closed = (await db.runAsync(
    "INSERT INTO accounts (board_id, name, type, on_budget, opening_balance_cents) VALUES (?, 'Old chequing', 'cash', 1, 20000)",
    boardId,
  )).lastInsertRowId;
  await txn(closed, cat, -1234, `${month}-01`);
  await db.runAsync("UPDATE accounts SET archived_at = datetime('now') WHERE id = ?", closed);
  // Two readings on one day: the later insert wins.
  for (const cents of [100000, 200000])
    await db.runAsync(
      "INSERT INTO account_value_history (account_id, value_cents, effective_date, kind) VALUES (?, ?, ?, 'value')",
      trackingId, cents, plusDays(today, -1),
    );
  // Assigned ahead of this month.
  await db.runAsync(
    'INSERT INTO budget_entries (board_id, category_id, month, assigned_cents) VALUES (?, ?, ?, ?)',
    boardId, cat, nextMonth(month), 4200,
  );
}

async function rows() {
  const accounts = (await db.getAllAsync<Record<string, unknown>>('SELECT * FROM accounts WHERE board_id = ?', boardId)).map(
    (a) => ({ ...a, id: String(a.id) }) as unknown as AccountRec,
  );
  const txns = (await db.getAllAsync<{ id: number; account_id: number; category_id: number | null; amount_cents: number; date: string }>(
    'SELECT id, account_id, category_id, amount_cents, date FROM transactions WHERE board_id = ?', boardId,
  )).map<TxnRec>((t) => ({
    account_id: String(t.account_id),
    category_id: t.category_id == null ? null : String(t.category_id),
    amount_cents: t.amount_cents,
    date: t.date,
    tie: t.id,
  }));
  const entries = (await db.getAllAsync<{ category_id: number; month: string; assigned_cents: number }>(
    'SELECT category_id, month, assigned_cents FROM budget_entries WHERE board_id = ?', boardId,
  )).map<EntryRec>((e) => ({ ...e, category_id: String(e.category_id) }));
  const values = (await db.getAllAsync<{ id: number; account_id: number; kind: string; value_cents: number; effective_date: string }>(
    'SELECT h.* FROM account_value_history h JOIN accounts a ON a.id = h.account_id WHERE a.board_id = ?', boardId,
  )).map<ValueRec>((v) => ({ account_id: String(v.account_id), kind: v.kind, value_cents: v.value_cents, effective_date: v.effective_date, tie: v.id }));
  const rates = (await db.getAllAsync<{ id: number; account_id: number; rate_bps: number; effective_date: string }>(
    'SELECT h.* FROM account_rate_history h JOIN accounts a ON a.id = h.account_id WHERE a.board_id = ?', boardId,
  )).map<RateRec>((r) => ({ account_id: String(r.account_id), rate_bps: r.rate_bps, effective_date: r.effective_date, tie: r.id }));
  return { accounts, txns, entries, values, rates };
}

beforeAll(async () => {
  db = openDatabase('parity.db', '/documents/SQLite');
  await migrate(db);
  boardId = await seedDemoBoard(db);
  await edgeCases();
  await budgetsRepo.closePastBudgetMonths(db, boardId);
});

it('covers the cases that matter', async () => {
  const { accounts, txns, entries } = await rows();
  const types = new Set(accounts.map((a) => a.type));
  for (const t of ['cash', 'credit_card', 'savings', 'loan', 'mortgage', 'tracking', 'asset']) expect(types).toContain(t);
  expect(accounts.some((a) => a.archived_at != null)).toBe(true);
  expect(txns.some((t) => t.date > currentDateISO())).toBe(true);
  expect(entries.some((e) => e.month < currentMonth())).toBe(true);
});

it('category figures match useBudget for every month', async () => {
  const { accounts, txns, entries } = await rows();
  const categoryIds = (await categoriesRepo.listCategories(db, boardId)).map((c) => c.id);
  const months = [...lastNMonths(currentMonth(), 14), nextMonth(currentMonth())];
  const statuses = new Set<string>();
  for (const month of months) {
    const [cumAssigned, cumActivity, thisAssigned, thisActivity] = await Promise.all([
      budgetsRepo.cumulativeAssignedByCategory(db, boardId, month),
      budgetsRepo.cumulativeActivityByCategory(db, boardId, month),
      budgetsRepo.assignedThisMonthByCategory(db, boardId, month),
      budgetsRepo.activityThisMonthByCategory(db, boardId, month),
    ]);
    const pure = categoryFigures(categoryIds.map(String), accounts, entries, txns, month, currentDateISO());
    for (const id of categoryIds) {
      const balanceCents = categoryBalanceCents(cumAssigned[id] ?? 0, cumActivity[id] ?? 0);
      const activityThisMonthCents = thisActivity[id] ?? 0;
      const fundedCents = categoryFundedCents(balanceCents, activityThisMonthCents);
      const status = categoryStatus(balanceCents, fundedCents);
      statuses.add(status);
      expect({ month, id, ...pure.get(String(id)) }).toEqual({
        month,
        id,
        assignedThisMonthCents: thisAssigned[id] ?? 0,
        activityThisMonthCents,
        balanceCents,
        fundedCents,
        status,
        captionText: categoryCaption(status, balanceCents, fundedCents),
      });
    }
  }
  expect(statuses).toContain('overspent');
  expect(statuses).toContain('funded');
});

it('Unassigned breakdown matches', async () => {
  const { accounts, txns, entries } = await rows();
  const phone = await budgetsRepo.unassignedBreakdown(db, boardId);
  expect(unassignedBreakdown(accounts, entries, txns, currentDateISO())).toEqual(phone);
  expect(phone.assignedAheadCents).not.toBe(0);
  expect(phone.cardDebtCents).not.toBe(0);
});

it('account balances match, open and closed', async () => {
  const { accounts, txns, values, rates } = await rows();
  const phone = [
    ...(await accountsRepo.listAccountsWithBalances(db, boardId)),
    ...(await accountsRepo.listClosedAccounts(db, boardId)),
  ];
  const pure = accountBalances(accounts, txns, values, rates, currentDateISO());
  expect(phone.length).toBe(accounts.length);
  for (const { account, balanceCents } of phone)
    expect({ name: account.name, type: account.type, balanceCents }).toEqual({
      name: account.name,
      type: account.type,
      balanceCents: pure.get(String(account.id)),
    });
});
