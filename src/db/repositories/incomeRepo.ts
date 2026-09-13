import type { SQLiteDatabase } from 'expo-sqlite';
import * as settingsRepo from './settingsRepo';
import { currentDateISO, nextMonth } from '../../domain/month';
import { MONTHLY_INCOME_FOR_ACCOUNT, INCOME_TOTAL_FOR_ACCOUNT_IN_RANGE } from '../../../databases/queries/income';

// One default per board, set in Settings — every 'income' account sweeps
// there (see transactionsRepo's income auto-transfer) unless the account
// itself *is* the default, in which case there's nothing to sweep to.
const defaultCashAccountKey = (boardId: number) => `income.defaultCashAccountId:${boardId}`;

export async function getDefaultCashAccountId(db: SQLiteDatabase, boardId: number): Promise<number | null> {
  const raw = await settingsRepo.getSetting(db, defaultCashAccountKey(boardId));
  return raw ? Number(raw) : null;
}

export async function setDefaultCashAccountId(db: SQLiteDatabase, boardId: number, accountId: number | null): Promise<void> {
  if (accountId == null) await settingsRepo.setSetting(db, defaultCashAccountKey(boardId), '');
  else await settingsRepo.setSetting(db, defaultCashAccountKey(boardId), String(accountId));
}

export interface MonthlyIncomePoint {
  month: string; // 'YYYY-MM'
  totalCents: number;
}

export async function monthlyIncomeForAccount(
  db: SQLiteDatabase,
  boardId: number,
  accountId: number,
  startMonth: string,
  endMonth: string,
): Promise<MonthlyIncomePoint[]> {
  const rows = await db.getAllAsync<{ month: string; total: number }>(
    MONTHLY_INCOME_FOR_ACCOUNT,
    accountId,
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
  accountId: number,
  startDate: string,
  endDateExclusive: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    INCOME_TOTAL_FOR_ACCOUNT_IN_RANGE,
    accountId,
    startDate,
    endDateExclusive,
    currentDateISO(),
    boardId,
  );
  return row?.total ?? 0;
}
