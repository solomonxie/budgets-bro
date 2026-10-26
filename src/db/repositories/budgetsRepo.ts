import type { SQLiteDatabase } from '../../db/driver';
import { nextMonth, previousMonth, currentDateISO, currentMonth } from '../../domain/month';
import {
  averageMonthlySpentCents,
  categoryBalanceCents,
  closePastMonths,
  unassignedCashCents,
} from '../../domain/budgetMath';
import type { CategoryMonthTotals } from '../../domain/budgetMath';
import {
  ASSIGNED_THIS_MONTH,
  CUMULATIVE_ASSIGNED,
  CUMULATIVE_ACTIVITY,
  ACTIVITY_THIS_MONTH,
  TOTAL_ACTIVITY_BY_MONTH,
  ACTIVITY_BY_CATEGORY_MONTH,
  MONTHLY_ASSIGNED_BY_CATEGORY,
  MONTHLY_ACTIVITY_BY_CATEGORY,
  TOTAL_ASSIGNED_THROUGH_MONTH,
  TOTAL_ASSIGNED_ALL_MONTHS,
  TOTAL_ASSIGNED_AFTER_MONTH,
  TOTAL_ACTIVITY_THROUGH_MONTH,
  CASH_ACCOUNTS_BALANCE_THROUGH_MONTH,
  CREDIT_CARD_BALANCE_THROUGH_MONTH,
  UPSERT_ASSIGNED_CENTS,
  ADD_ASSIGNED_CENTS,
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

// Each category's usual month of spending across `months` (ascending,
// contiguous), for the budget bar's average mark.
export async function averageMonthlySpentByCategory(
  db: SQLiteDatabase,
  boardId: number,
  months: string[],
): Promise<Record<number, number>> {
  if (months.length === 0) return {};
  const rows = await db.getAllAsync<{
    category_id: number;
    month: string;
    total: number;
  }>(
    ACTIVITY_BY_CATEGORY_MONTH,
    `${months[0]}-01`,
    `${nextMonth(months[months.length - 1])}-01`,
    currentDateISO(),
    boardId,
  );
  const byCategory: Record<number, Record<string, number>> = {};
  for (const r of rows) (byCategory[r.category_id] ??= {})[r.month] = r.total;
  const map: Record<number, number> = {};
  for (const [id, byMonth] of Object.entries(byCategory))
    map[Number(id)] = averageMonthlySpentCents(byMonth, months);
  return map;
}

// Assigned in every month there is an entry for, including future ones.
export async function totalAssigned(
  db: SQLiteDatabase,
  boardId: number,
): Promise<number> {
  return sumOrZero(db, TOTAL_ASSIGNED_ALL_MONTHS, boardId);
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
// one number rather than the totals behind it.
export async function unassignedCashNow(
  db: SQLiteDatabase,
  boardId: number,
): Promise<number> {
  return (await unassignedBreakdown(db, boardId)).unassignedCents;
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
  // The slice of the above promised to months after this one. Usually the
  // whole answer to "why is Unassigned negative?" — money given to next
  // month has left today's pile, and nothing else on screen says where.
  assignedAheadCents: number;
  unassignedCents: number;
  // Owed on credit cards, as a positive number. Spending on a card empties
  // an envelope without touching cash, so this much of `unassignedCents` is
  // already spoken for; see the query's own note.
  cardDebtCents: number;
}

// The arithmetic behind Unassigned Cash, so the number can be checked
// rather than taken on faith — it is cumulative across every month, which
// is not what "unassigned" sounds like.
// Deliberately not a function of the month on screen. Unassigned cash is a
// stock, not a flow: there is one pile of money, and either it has a job
// today or it doesn't. Scoping it to the month being browsed answered a
// different question — "had this been assigned yet, as of September?" — and
// the same dollars then read as free in September and spoken for in
// October, which is an invitation to assign them twice.
//
// So: cash and activity as of today, assignments across every month there is
// an entry for, future ones included.
export async function unassignedBreakdown(
  db: SQLiteDatabase,
  boardId: number,
): Promise<UnassignedBreakdown> {
  const throughMonth = currentMonth();
  const endExclusive = `${nextMonth(throughMonth)}-01`;
  const today = currentDateISO();
  const [assigned, activity, cashCents, cardBalance, assignedAheadCents] = await Promise.all([
    totalAssigned(db, boardId),
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
    sumOrZero(db, TOTAL_ASSIGNED_AFTER_MONTH, throughMonth, boardId),
  ]);
  const envelopesCents = categoryBalanceCents(assigned, activity);
  return {
    cashCents,
    envelopesCents,
    assignedAheadCents,
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

// Two screens refreshing at once would each add the same leftover.
let closing: Promise<void> | null = null;

// Closes every month before this one (see domain/budgetMath.closePastMonths).
// Runs before the budget is read, so a backdated spend or an edit to an old
// month settles into this month the next time anyone looks.
export function closePastBudgetMonths(
  db: SQLiteDatabase,
  boardId: number,
): Promise<void> {
  closing = (closing ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const current = currentMonth();
      const totals = await monthlyTotalsByCategory(db, boardId, previousMonth(current));
      const changes = Object.entries(totals)
        .map(([id, months]) => ({ categoryId: Number(id), ...closePastMonths(months, current) }))
        .filter((c) => c.assigned.length > 0 || c.carryCents !== 0);
      if (changes.length === 0) return;
      await db.withTransactionAsync(async () => {
        for (const c of changes) {
          for (const m of c.assigned)
            await db.runAsync(UPSERT_ASSIGNED_CENTS, c.categoryId, m.month, m.assignedCents, boardId);
          if (c.carryCents !== 0)
            await db.runAsync(ADD_ASSIGNED_CENTS, c.categoryId, current, c.carryCents, boardId);
        }
      });
    });
  return closing;
}
