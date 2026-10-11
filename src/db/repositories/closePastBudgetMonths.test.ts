/**
 * @jest-environment node
 */
import { openDatabase } from '../driver';
import type { SQLiteDatabase } from '../driver';
import { migrate } from '../migrate';
import { seedDemoBoard } from '../seed/demoBoard';
import * as budgetsRepo from './budgetsRepo';
import { currentMonth, previousMonth } from '../../domain/month';

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

const pastMonthNets = async () => {
  const totals = await budgetsRepo.monthlyTotalsByCategory(db, boardId, previousMonth(currentMonth()));
  return Object.values(totals)
    .flat()
    .map((m) => m.assignedCents + m.activityCents)
    .filter((n) => n !== 0);
};

describe('closePastBudgetMonths', () => {
  it('closes every past month at zero, keeping leftovers and covering overspends', async () => {
    const month = currentMonth();
    const before = await budgetsRepo.cumulativeAssignedByCategory(db, boardId, month);
    const activity = await budgetsRepo.cumulativeActivityByCategory(db, boardId, month);
    const balanceBefore = (id: string) => (before[Number(id)] ?? 0) + (activity[Number(id)] ?? 0);
    const unassignedBefore = (await budgetsRepo.unassignedBreakdown(db, boardId)).unassignedCents;

    await Promise.all([
      budgetsRepo.closePastBudgetMonths(db, boardId),
      budgetsRepo.closePastBudgetMonths(db, boardId),
    ]);

    expect(await pastMonthNets()).toEqual([]);
    const after = await budgetsRepo.cumulativeAssignedByCategory(db, boardId, month);
    let covered = 0;
    for (const id of Object.keys({ ...before, ...activity })) {
      const balanceAfter = (after[Number(id)] ?? 0) + (activity[Number(id)] ?? 0);
      // Only ever gains: a covered overspend, never a lost leftover.
      expect(balanceAfter).toBeGreaterThanOrEqual(balanceBefore(id));
      covered += balanceAfter - balanceBefore(id);
    }
    const unassignedAfter = (await budgetsRepo.unassignedBreakdown(db, boardId)).unassignedCents;
    expect(unassignedBefore - unassignedAfter).toBe(covered);
  });

  it('does nothing the second time', async () => {
    const month = currentMonth();
    const before = await budgetsRepo.cumulativeAssignedByCategory(db, boardId, month);
    await budgetsRepo.closePastBudgetMonths(db, boardId);
    expect(await budgetsRepo.cumulativeAssignedByCategory(db, boardId, month)).toEqual(before);
  });
});
