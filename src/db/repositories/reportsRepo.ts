import type { SQLiteDatabase } from '../../db/driver';
import { nextMonth, currentDateISO } from '../../domain/month';
import {
  SPENDING_BY_CATEGORY,
  SPENDING_BY_CATEGORY_OVER_MONTHS,
  EARLIEST_TRANSACTION_MONTH,
  INCOME_AND_SPENDING_IN_RANGE,
  INCOME_BY_PAYEE_IN_RANGE,
  SPENDING_BY_PAYEE_OVER_MONTHS,
} from '../../../databases/queries/reports';

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
    currentDateISO(),
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
    currentDateISO(),
    boardId,
  );
  return rows.map((r) => ({ categoryId: r.category_id, name: r.name, icon: r.icon, month: r.month, spentCents: r.total }));
}

// First month with any transaction, board-scoped — the start of the "all
// time" category-trend window. Null for a brand-new board with no history.
export async function earliestTransactionMonth(db: SQLiteDatabase, boardId: number): Promise<string | null> {
  const row = await db.getFirstAsync<{ month: string | null }>(EARLIEST_TRANSACTION_MONTH, boardId);
  return row?.month ?? null;
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
  const today = currentDateISO();
  const row = await db.getFirstAsync<{ income_cents: number; spending_cents: number }>(
    INCOME_AND_SPENDING_IN_RANGE,
    boardId,
    startDate,
    endDateExclusive,
    today,
    boardId,
    startDate,
    endDateExclusive,
    today,
  );
  return { incomeCents: row?.income_cents ?? 0, spendingCents: row?.spending_cents ?? 0 };
}

// Total inbound money landing in any of `accountIds` within [startDate,
// endDateExclusive) — deposits and transfers-in alike, unlike
// incomeAndSpendingInRange's income_cents which excludes transfers. Powers
// Baby Step 4's "retirement contributions vs income" check, where a
// transfer from checking into the retirement account is exactly the
// contribution we want to count. Dynamic IN-list, so built inline rather
// than as a static export — see transactionsRepo.deleteTransactions.
export async function depositsIntoAccountsInRange(
  db: SQLiteDatabase,
  boardId: number,
  accountIds: number[],
  startDate: string,
  endDateExclusive: string,
): Promise<number> {
  if (accountIds.length === 0) return 0;
  const placeholders = accountIds.map(() => '?').join(',');
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) as total FROM transactions
     WHERE board_id = ? AND account_id IN (${placeholders}) AND amount_cents > 0 AND date >= ? AND date < ? AND date <= ?`,
    boardId,
    ...accountIds,
    startDate,
    endDateExclusive,
    currentDateISO(),
  );
  return row?.total ?? 0;
}

export interface CategoryRangeTotals {
  incomeCents: number;
  expenseCents: number;
}

// Both directions for a category set in one query — e.g. an "Interest"
// category can hold both interest earned (positive) and interest paid
// (negative) transactions, and Tax Insights wants both without asking the
// user to pick two separate category sets.
export async function categoryIncomeAndExpenseInRange(
  db: SQLiteDatabase,
  boardId: number,
  categoryIds: number[],
  startDate: string,
  endDateExclusive: string,
): Promise<CategoryRangeTotals> {
  if (categoryIds.length === 0) return { incomeCents: 0, expenseCents: 0 };
  const placeholders = categoryIds.map(() => '?').join(',');
  const row = await db.getFirstAsync<{ income_cents: number; expense_cents: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.amount_cents > 0 THEN t.amount_cents ELSE 0 END), 0) as income_cents,
       COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as expense_cents
     FROM transactions t JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
     WHERE t.board_id = ? AND t.category_id IN (${placeholders}) AND t.transfer_account_id IS NULL
       AND t.date >= ? AND t.date < ? AND t.date <= ?`,
    boardId,
    ...categoryIds,
    startDate,
    endDateExclusive,
    currentDateISO(),
  );
  return { incomeCents: row?.income_cents ?? 0, expenseCents: row?.expense_cents ?? 0 };
}

// Total spend tagged to any of `categoryIds` within [startDate,
// endDateExclusive) — same on-budget/non-transfer rules as
// SPENDING_BY_CATEGORY, just summed across an arbitrary category set and
// date range instead of one month. Powers Baby Step 7's donation total.
export async function categorySpendingInRange(
  db: SQLiteDatabase,
  boardId: number,
  categoryIds: number[],
  startDate: string,
  endDateExclusive: string,
): Promise<number> {
  if (categoryIds.length === 0) return 0;
  const placeholders = categoryIds.map(() => '?').join(',');
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(-t.amount_cents), 0) as total FROM transactions t
     JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
     WHERE t.board_id = ? AND t.category_id IN (${placeholders}) AND t.amount_cents < 0
       AND t.transfer_account_id IS NULL AND t.date >= ? AND t.date < ? AND t.date <= ?`,
    boardId,
    ...categoryIds,
    startDate,
    endDateExclusive,
    currentDateISO(),
  );
  return row?.total ?? 0;
}

export interface IncomeSource {
  payeeId: number | null;
  payeeName: string | null;
  totalCents: number;
}

// Income broken down by who paid it, biggest first — what the tax screen's
// "Income by source" reads now that income accounts are gone (migration 028).
export async function incomeByPayeeInRange(
  db: SQLiteDatabase,
  boardId: number,
  startDate: string,
  endDateExclusive: string,
): Promise<IncomeSource[]> {
  const rows = await db.getAllAsync<{ payee_id: number | null; payee_name: string | null; total: number }>(
    INCOME_BY_PAYEE_IN_RANGE,
    boardId,
    startDate,
    endDateExclusive,
    currentDateISO(),
  );
  return rows.map((r) => ({ payeeId: r.payee_id, payeeName: r.payee_name, totalCents: r.total }));
}

export interface PayeeTrendPoint {
  payeeId: number | null;
  name: string | null;
  month: string;
  spentCents: number;
  count: number;
}

// Raw (payee, month) spend points across `months` — Payee Trend ranks
// these and plots each payee's own series, the same pivot-in-memory shape
// spendingByCategoryOverMonths feeds the category trend.
export async function spendingByPayeeOverMonths(db: SQLiteDatabase, boardId: number, months: string[]): Promise<PayeeTrendPoint[]> {
  if (months.length === 0) return [];
  const start = `${months[0]}-01`;
  const endExclusive = `${nextMonth(months[months.length - 1])}-01`;
  const rows = await db.getAllAsync<{ payee_id: number | null; payee_name: string | null; month: string; total: number; count: number }>(
    SPENDING_BY_PAYEE_OVER_MONTHS,
    start,
    endExclusive,
    currentDateISO(),
    boardId,
  );
  return rows.map((r) => ({ payeeId: r.payee_id, name: r.payee_name, month: r.month, spentCents: r.total, count: r.count }));
}
