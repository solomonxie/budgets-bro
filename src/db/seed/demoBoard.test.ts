/**
 * @jest-environment node
 */
import { openDatabase } from '../driver';
import type { SQLiteDatabase } from '../driver';
import { migrate } from '../migrate';
import { seedDemoBoard } from './demoBoard';
import * as boardsRepo from '../repositories/boardsRepo';
import * as accountsRepo from '../repositories/accountsRepo';
import * as transactionsRepo from '../repositories/transactionsRepo';
import * as scheduledTransactionsRepo from '../repositories/scheduledTransactionsRepo';
import * as paymentReviewRepo from '../repositories/paymentReviewRepo';
import * as customGoalsRepo from '../repositories/customGoalsRepo';
import * as housesRepo from '../repositories/housesRepo';
import * as communityPricesRepo from '../repositories/communityPricesRepo';
import { currentDateISO } from '../../domain/month';
import { addMonths } from '../../finance-tools/amortization';
import { DETECTION_WINDOW_MONTHS, buildReviewItems, detectRecurring } from '../../domain/paymentReview';
import { summarizePurchaseItems } from '../../domain/trackedPrices';

// A real SQLite (Node's built-in) behind the op-sqlite surface the driver wraps.
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
jest.mock('../preMigrationSnapshot', () => ({ takeSnapshot: async () => {} }));

let db: SQLiteDatabase;
let boardId: number;

beforeAll(async () => {
  db = openDatabase('demo.db', '/documents/SQLite');
  await migrate(db);
  boardId = await seedDemoBoard(db);
}, 60000);

const count = async (sql: string, ...params: (string | number)[]) =>
  (await db.getFirstAsync<{ n: number }>(sql, ...params))!.n;

describe('seedDemoBoard', () => {
  it('writes nothing dated after today', async () => {
    expect(await count('SELECT COUNT(*) n FROM transactions WHERE board_id = ? AND date > ?', boardId, currentDateISO())).toBe(0);
    const n = await count('SELECT COUNT(*) n FROM transactions WHERE board_id = ?', boardId);
    expect(n).toBeGreaterThan(1000);
    expect(n).toBeLessThan(4000);
  });

  it('is deterministic', async () => {
    const second = await seedDemoBoard(db);
    const sum = (id: number) => count('SELECT SUM(amount_cents) n FROM transactions WHERE board_id = ?', id);
    expect(await sum(second)).toBe(await sum(boardId));
  });

  it('keeps cash accounts positive', async () => {
    const accounts = await accountsRepo.listAccountsWithBalances(db, boardId);
    for (const name of ['Everyday Chequing', 'High-Interest Savings', 'RRSP', 'TFSA', 'Family RESP']) {
      expect(accounts.find((a) => a.account.name === name)!.balanceCents).toBeGreaterThan(0);
    }
  });

  it('puts loan payments in the board’s own loan categories', async () => {
    expect(await count("SELECT COUNT(*) n FROM category_groups WHERE board_id = ? AND name = 'Loan Payments'", boardId)).toBe(0);
  });

  it('has schedules, one awaiting approval', async () => {
    expect((await scheduledTransactionsRepo.listForBoard(db, boardId)).length).toBeGreaterThan(10);
    expect((await scheduledTransactionsRepo.listDue(db, boardId, currentDateISO())).length).toBeGreaterThan(0);
  });

  it('fills QBR: due items, to-dos and history', async () => {
    const today = currentDateISO();
    const schedules = await paymentReviewRepo.listReviewableSchedules(db, boardId);
    const repeated = await paymentReviewRepo.listRepeatedCharges(db, boardId, addMonths(today, -DETECTION_WINDOW_MONTHS), today);
    const items = buildReviewItems(schedules, detectRecurring(repeated, today), today);
    const names = items.map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(['Netflix', 'Amazon Prime', 'Spotify', 'Microsoft 365', 'Namecheap']));
    expect(items.some((i) => i.due)).toBe(true);
    const decisions = await paymentReviewRepo.listDecisions(db, boardId);
    expect(decisions.filter((d) => d.doneOn == null)).toHaveLength(2);
    expect(decisions.filter((d) => d.doneOn != null)).toHaveLength(2);
  });

  it('has tracked prices with history', async () => {
    const rows = await transactionsRepo.listPurchaseItemRows(db, boardId);
    const summary = summarizePurchaseItems(rows);
    expect(summary.length).toBeGreaterThan(10);
    expect(summary[0].count).toBeGreaterThan(20);
  });

  it('has several income payers', async () => {
    const payers = await db.getAllAsync<{ name: string }>(
      `SELECT DISTINCT p.name FROM transactions t JOIN payees p ON p.id = t.payee_id JOIN accounts a ON a.id = t.account_id
       WHERE t.board_id = ? AND t.amount_cents > 0 AND t.transfer_account_id IS NULL AND a.on_budget = 1`,
      boardId,
    );
    expect(payers.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Meridian Robotics Inc', 'Alderbrook Consulting Group', 'Northwind Studio', 'Canada Child Benefit']),
    );
  });

  it('has flagged rows, goals, houses and community prices', async () => {
    expect(await count('SELECT COUNT(*) n FROM transactions WHERE board_id = ? AND payee_id IS NULL', boardId)).toBeGreaterThan(0);
    expect((await customGoalsRepo.listForBoard(db, boardId)).length).toBe(3);
    expect((await housesRepo.listHouses(db, boardId)).length).toBe(5);
    expect((await communityPricesRepo.listPrices(db, boardId)).length).toBe(24);
  });

  // Last: removes the board the tests above read.
  it('deletes cleanly with foreign keys on', async () => {
    await db.execAsync('PRAGMA foreign_keys = ON');
    const boards = await boardsRepo.listBoards(db);
    for (const b of boards) await boardsRepo.deleteBoard(db, b.id);
    for (const table of ['accounts', 'categories', 'transactions', 'houses', 'community_prices', 'payment_decisions'])
      expect(await count(`SELECT COUNT(*) AS n FROM ${table}`)).toBe(0);
  });
});
