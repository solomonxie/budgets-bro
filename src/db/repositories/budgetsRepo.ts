import type { SQLiteDatabase } from 'expo-sqlite';
import { nextMonth } from '../../domain/month';
import {
  ASSIGNED_THIS_MONTH,
  CUMULATIVE_ASSIGNED,
  CUMULATIVE_ACTIVITY,
  ACTIVITY_THIS_MONTH,
  TOTAL_ASSIGNED_THROUGH_MONTH,
  TOTAL_ACTIVITY_THROUGH_MONTH,
  CASH_ACCOUNTS_BALANCE_THROUGH_MONTH,
  UPSERT_ASSIGNED_CENTS,
} from '../../../databases/queries/budgets';

async function sumOrZero(
  db: SQLiteDatabase,
  sql: string,
  ...params: (string | number)[]
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(sql, ...params);
  return row?.total ?? 0;
}

export async function assignedThisMonthByCategory(
  db: SQLiteDatabase,
  boardId: number,
  month: string,
): Promise<Record<number, number>> {
  const rows = await db.getAllAsync<{ category_id: number; assigned_cents: number }>(ASSIGNED_THIS_MONTH, month, boardId);
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.assigned_cents;
  return map;
}

export async function cumulativeAssignedByCategory(
  db: SQLiteDatabase,
  boardId: number,
  throughMonth: string,
): Promise<Record<number, number>> {
  const rows = await db.getAllAsync<{ category_id: number; total: number }>(CUMULATIVE_ASSIGNED, throughMonth, boardId);
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.total;
  return map;
}

export async function cumulativeActivityByCategory(
  db: SQLiteDatabase,
  boardId: number,
  throughMonth: string,
): Promise<Record<number, number>> {
  const endExclusive = `${nextMonth(throughMonth)}-01`;
  const rows = await db.getAllAsync<{ category_id: number; total: number }>(CUMULATIVE_ACTIVITY, endExclusive, boardId);
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.total;
  return map;
}

export async function activityThisMonthByCategory(db: SQLiteDatabase, boardId: number, month: string): Promise<Record<number, number>> {
  const start = `${month}-01`;
  const endExclusive = `${nextMonth(month)}-01`;
  const rows = await db.getAllAsync<{ category_id: number; total: number }>(ACTIVITY_THIS_MONTH, start, endExclusive, boardId);
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.total;
  return map;
}

export async function totalAssignedThroughMonth(db: SQLiteDatabase, boardId: number, throughMonth: string): Promise<number> {
  return sumOrZero(db, TOTAL_ASSIGNED_THROUGH_MONTH, throughMonth, boardId);
}

export async function totalActivityThroughMonth(db: SQLiteDatabase, boardId: number, throughMonth: string): Promise<number> {
  const endExclusive = `${nextMonth(throughMonth)}-01`;
  return sumOrZero(db, TOTAL_ACTIVITY_THROUGH_MONTH, endExclusive, boardId);
}

export async function cashAccountsBalanceThroughMonth(db: SQLiteDatabase, boardId: number, throughMonth: string): Promise<number> {
  const endExclusive = `${nextMonth(throughMonth)}-01`;
  return sumOrZero(db, CASH_ACCOUNTS_BALANCE_THROUGH_MONTH, boardId, boardId, endExclusive);
}

export async function setAssignedCents(
  db: SQLiteDatabase,
  boardId: number,
  categoryId: number,
  month: string,
  assignedCents: number,
): Promise<void> {
  await db.runAsync(UPSERT_ASSIGNED_CENTS, categoryId, month, assignedCents, boardId);
}

// Moves a category's full current balance back to Unassigned Cash by
// reducing this month's assigned amount by the balance — correct regardless
// of which past month actually funded it, since balance is a cumulative sum.
// Doesn't clamp at 0: the balance may have been funded by an earlier month's
// rollover, so this month's own assigned entry legitimately needs to go
// negative to cancel it out.
export async function moveToUnassigned(
  db: SQLiteDatabase,
  boardId: number,
  categoryId: number,
  month: string,
  balanceCents: number,
): Promise<void> {
  if (balanceCents <= 0) return;
  const current = await sumOrZero(
    db,
    'SELECT assigned_cents as total FROM budget_entries WHERE category_id = ? AND month = ?',
    categoryId,
    month,
  );
  await setAssignedCents(db, boardId, categoryId, month, current - balanceCents);
}
