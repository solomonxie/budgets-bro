import type { SQLiteDatabase } from 'expo-sqlite';
import { nextMonth } from '../../domain/month';
import { SPENDING_BY_CATEGORY, SPENDING_BY_CATEGORY_OVER_MONTHS, INCOME_AND_SPENDING_IN_RANGE } from '../../../databases/queries/reports';

export interface CategorySpend {
  categoryId: number;
  name: string;
  icon: string | null;
  spentCents: number;
}

export async function spendingByCategory(db: SQLiteDatabase, boardId: number, month: string): Promise<CategorySpend[]> {
  const start = `${month}-01`;
  const endExclusive = `${nextMonth(month)}-01`;
  const rows = await db.getAllAsync<{ category_id: number; name: string; icon: string | null; total: number }>(
    SPENDING_BY_CATEGORY,
    start,
    endExclusive,
    boardId,
  );
  return rows.map((r) => ({ categoryId: r.category_id, name: r.name, icon: r.icon, spentCents: r.total }));
}

export interface CategoryTrendPoint {
  categoryId: number;
  name: string;
  icon: string | null;
  month: string;
  spentCents: number;
}

// Raw (category, month) spend points across `months` — the Insights screen
// pivots these into per-category series and picks the top few to plot.
export async function spendingByCategoryOverMonths(db: SQLiteDatabase, boardId: number, months: string[]): Promise<CategoryTrendPoint[]> {
  if (months.length === 0) return [];
  const start = `${months[0]}-01`;
  const endExclusive = `${nextMonth(months[months.length - 1])}-01`;
  const rows = await db.getAllAsync<{ category_id: number; name: string; icon: string | null; month: string; total: number }>(
    SPENDING_BY_CATEGORY_OVER_MONTHS,
    start,
    endExclusive,
    boardId,
  );
  return rows.map((r) => ({ categoryId: r.category_id, name: r.name, icon: r.icon, month: r.month, spentCents: r.total }));
}

export interface RangeTotals {
  incomeCents: number;
  spendingCents: number;
}

// Income/spending for [startDate, endDateExclusive) — used by Tax Insights
// for a calendar-year total. Same on-budget/non-transfer rules as budget math.
export async function incomeAndSpendingInRange(
  db: SQLiteDatabase,
  boardId: number,
  startDate: string,
  endDateExclusive: string,
): Promise<RangeTotals> {
  const row = await db.getFirstAsync<{ income_cents: number; spending_cents: number }>(
    INCOME_AND_SPENDING_IN_RANGE,
    boardId,
    startDate,
    endDateExclusive,
    boardId,
    startDate,
    endDateExclusive,
  );
  return { incomeCents: row?.income_cents ?? 0, spendingCents: row?.spending_cents ?? 0 };
}
