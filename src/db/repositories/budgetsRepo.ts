import type { SQLiteDatabase } from '../../db/driver';
import { nextMonth, currentDateISO } from '../../domain/month';
import {
  categoryBalanceCents,
  unassignedCashCents,
} from '../../domain/budgetMath';
import type { CategoryMonthTotals } from '../../domain/budgetMath';
import {
  ASSIGNED_THIS_MONTH,
  CUMULATIVE_ASSIGNED,
  CUMULATIVE_ACTIVITY,
  ACTIVITY_THIS_MONTH,
  TOTAL_ACTIVITY_BY_MONTH,
  MONTHLY_ASSIGNED_BY_CATEGORY,
  MONTHLY_ACTIVITY_BY_CATEGORY,
  TOTAL_ASSIGNED_THROUGH_MONTH,
  TOTAL_ACTIVITY_THROUGH_MONTH,
  CASH_ACCOUNTS_BALANCE_THROUGH_MONTH,
  CREDIT_CARD_BALANCE_THROUGH_MONTH,
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
  const rows = await db.getAllAsync<{
    category_id: number;
    assigned_cents: number;
  }>(ASSIGNED_THIS_MONTH, month, boardId);
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.assigned_cents;
  return map;
}

export async function cumulativeAssignedByCategory(
  db: SQLiteDatabase,
  boardId: number,
  throughMonth: string,
): Promise<Record<number, number>> {
  const rows = await db.getAllAsync<{ category_id: number; total: number }>(
    CUMULATIVE_ASSIGNED,
    throughMonth,
    boardId,
  );
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
  const rows = await db.getAllAsync<{ category_id: number; total: number }>(
    CUMULATIVE_ACTIVITY,
    endExclusive,
    currentDateISO(),
    boardId,
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.total;
  return map;
}

export async function activityThisMonthByCategory(
  db: SQLiteDatabase,
  boardId: number,
  month: string,
): Promise<Record<number, number>> {
  const start = `${month}-01`;
  const endExclusive = `${nextMonth(month)}-01`;
  const rows = await db.getAllAsync<{ category_id: number; total: number }>(
    ACTIVITY_THIS_MONTH,
    start,
    endExclusive,
    currentDateISO(),
    boardId,
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.total;
  return map;
}

// One row per calendar month (ungrouped by category) across `months` —
// ascending, contiguous, e.g. from domain/month.lastNMonths — for a
// trailing-months average/median comparison.
export async function totalActivityByMonth(
  db: SQLiteDatabase,
  boardId: number,
  months: string[],
): Promise<Record<string, number>> {
  if (months.length === 0) return {};
  const start = `${months[0]}-01`;
  const endExclusive = `${nextMonth(months[months.length - 1])}-01`;
  const rows = await db.getAllAsync<{ month: string; total: number }>(
    TOTAL_ACTIVITY_BY_MONTH,
    start,
    endExclusive,
    currentDateISO(),
    boardId,
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.month] = r.total;
  return map;
}

export async function totalAssignedThroughMonth(
  db: SQLiteDatabase,
  boardId: number,
  throughMonth: string,
): Promise<number> {
  return sumOrZero(db, TOTAL_ASSIGNED_THROUGH_MONTH, throughMonth, boardId);
}

export async function totalActivityThroughMonth(
  db: SQLiteDatabase,
  boardId: number,
  throughMonth: string,
): Promise<number> {
  const endExclusive = `${nextMonth(throughMonth)}-01`;
  return sumOrZero(
    db,
    TOTAL_ACTIVITY_THROUGH_MONTH,
    endExclusive,
    currentDateISO(),
    boardId,
  );
}

export async function cashAccountsBalanceThroughMonth(
  db: SQLiteDatabase,
  boardId: number,
  throughMonth: string,
): Promise<number> {
  const endExclusive = `${nextMonth(throughMonth)}-01`;
  return sumOrZero(
    db,
    CASH_ACCOUNTS_BALANCE_THROUGH_MONTH,
    boardId,
    boardId,
    endExclusive,
    currentDateISO(),
  );
}

// Unassigned Cash as the budget screen shows it, for callers that want the
// one number rather than the three totals behind it.
export async function unassignedCashThroughMonth(
  db: SQLiteDatabase,
  boardId: number,
  throughMonth: string,
): Promise<number> {
  const [assigned, activity, cash] = await Promise.all([
    totalAssignedThroughMonth(db, boardId, throughMonth),
    totalActivityThroughMonth(db, boardId, throughMonth),
    cashAccountsBalanceThroughMonth(db, boardId, throughMonth),
  ]);
  return unassignedCashCents(cash, categoryBalanceCents(assigned, activity));
}

// Every category's month-by-month assigned and activity, for walking a
// running balance back to the month it first went negative (see
// domain/budgetMath.firstOverspentMonth).
export async function monthlyTotalsByCategory(
  db: SQLiteDatabase,
  boardId: number,
  throughMonth: string,
): Promise<Record<number, CategoryMonthTotals[]>> {
  const endExclusive = `${nextMonth(throughMonth)}-01`;
  const [assignedRows, activityRows] = await Promise.all([
    db.getAllAsync<{ category_id: number; month: string; total: number }>(
      MONTHLY_ASSIGNED_BY_CATEGORY,
      throughMonth,
      boardId,
    ),
    db.getAllAsync<{ category_id: number; month: string; total: number }>(
      MONTHLY_ACTIVITY_BY_CATEGORY,
      endExclusive,
      currentDateISO(),
      boardId,
    ),
  ]);

  const byCategory: Record<number, Map<string, CategoryMonthTotals>> = {};
  const entry = (categoryId: number, month: string): CategoryMonthTotals => {
    const months = (byCategory[categoryId] ??= new Map());
    let found = months.get(month);
    if (!found) {
      found = { month, assignedCents: 0, activityCents: 0 };
      months.set(month, found);
    }
    return found;
  };
  for (const row of assignedRows)
    entry(row.category_id, row.month).assignedCents = row.total;
  for (const row of activityRows)
    entry(row.category_id, row.month).activityCents = row.total;

  const result: Record<number, CategoryMonthTotals[]> = {};
  for (const [categoryId, months] of Object.entries(byCategory)) {
    result[Number(categoryId)] = [...months.values()].sort((a, b) =>
      a.month.localeCompare(b.month),
    );
  }
  return result;
}

export interface UnassignedBreakdown {
  cashCents: number;
  // What every category still holds between them — assigned minus spent,
  // all time, not just this month.
  envelopesCents: number;
  unassignedCents: number;
  // Owed on credit cards, as a positive number. Spending on a card empties
  // an envelope without touching cash, so this much of `unassignedCents` is
  // already spoken for; see the query's own note.
  cardDebtCents: number;
}

// The arithmetic behind Unassigned Cash, so the number can be checked
// rather than taken on faith — it is cumulative across every month, which
// is not what "unassigned" sounds like.
export async function unassignedBreakdown(
  db: SQLiteDatabase,
  boardId: number,
  throughMonth: string,
): Promise<UnassignedBreakdown> {
  const endExclusive = `${nextMonth(throughMonth)}-01`;
  const today = currentDateISO();
  const [assigned, activity, cashCents, cardBalance] = await Promise.all([
    totalAssignedThroughMonth(db, boardId, throughMonth),
    totalActivityThroughMonth(db, boardId, throughMonth),
    cashAccountsBalanceThroughMonth(db, boardId, throughMonth),
    sumOrZero(
      db,
      CREDIT_CARD_BALANCE_THROUGH_MONTH,
      boardId,
      boardId,
      endExclusive,
      today,
    ),
  ]);
  const envelopesCents = categoryBalanceCents(assigned, activity);
  return {
    cashCents,
    envelopesCents,
    unassignedCents: unassignedCashCents(cashCents, envelopesCents),
    cardDebtCents: Math.max(0, -cardBalance),
  };
}

export async function setAssignedCents(
  db: SQLiteDatabase,
  boardId: number,
  categoryId: number,
  month: string,
  assignedCents: number,
): Promise<void> {
  await db.runAsync(
    UPSERT_ASSIGNED_CENTS,
    categoryId,
    month,
    assignedCents,
    boardId,
  );
}
