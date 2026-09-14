import type { SQLiteDatabase } from 'expo-sqlite';
import { currentDateISO, nextMonth } from '../../domain/month';
import {
  MONTHLY_INCOME_FOR_ACCOUNT,
  INCOME_TOTAL_FOR_ACCOUNT_IN_RANGE,
  INCOME_THIS_YEAR_BY_ACCOUNT,
} from '../../../databases/queries/income';

export interface MonthlyIncomePoint {
  month: string; // 'YYYY-MM'
  totalCents: number;
}

export async function monthlyIncomeForAccount(
  db: SQLiteDatabase,
  boardId: number,
  incomeAccountId: number,
  startMonth: string,
  endMonth: string,
): Promise<MonthlyIncomePoint[]> {
  const rows = await db.getAllAsync<{ month: string; total: number }>(
    MONTHLY_INCOME_FOR_ACCOUNT,
    incomeAccountId,
    `${startMonth}-01`,
    `${nextMonth(endMonth)}-01`,
    currentDateISO(),
    boardId,
  );
  return rows.map((r) => ({ month: r.month, totalCents: r.total }));
}

export async function incomeTotalForAccountInRange(
  db: SQLiteDatabase,
  boardId: number,
  incomeAccountId: number,
  startDate: string,
  endDateExclusive: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    INCOME_TOTAL_FOR_ACCOUNT_IN_RANGE,
    incomeAccountId,
    startDate,
    endDateExclusive,
    currentDateISO(),
    boardId,
  );
  return row?.total ?? 0;
}

// Powers the Accounts list's Income group rows — this calendar year's
// total per income account, in one query rather than one per account.
export async function thisYearTotalsByBoard(db: SQLiteDatabase, boardId: number): Promise<Map<number, number>> {
  const year = currentDateISO().slice(0, 4);
  const rows = await db.getAllAsync<{ income_account_id: number; total: number }>(
    INCOME_THIS_YEAR_BY_ACCOUNT,
    `${year}-01-01`,
    `${Number(year) + 1}-01-01`,
    currentDateISO(),
    boardId,
  );
  return new Map(rows.map((r) => [r.income_account_id, r.total]));
}
