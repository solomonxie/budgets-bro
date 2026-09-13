import type { SQLiteDatabase } from 'expo-sqlite';
import type { IncomeDetailHistoryRow } from '../schema';
import type { IncomeDetail, IncomeUnit } from '../../domain/types';
import { LIST_INCOME_DETAIL_HISTORY } from '../../../databases/queries/incomeDetailHistory';

function mapRow(row: IncomeDetailHistoryRow): IncomeDetail {
  return {
    id: row.id,
    accountId: row.account_id,
    amountCents: row.amount_cents,
    unit: row.unit as IncomeUnit,
    effectiveDate: row.effective_date,
    note: row.note,
  };
}

export async function listHistory(db: SQLiteDatabase, accountId: number): Promise<IncomeDetail[]> {
  const rows = await db.getAllAsync<IncomeDetailHistoryRow>(LIST_INCOME_DETAIL_HISTORY, accountId);
  return rows.map(mapRow);
}

export interface IncomeDetailInput {
  amountCents: number;
  unit: IncomeUnit;
  effectiveDate: string;
  note: string | null;
}

export async function addDetail(db: SQLiteDatabase, accountId: number, input: IncomeDetailInput): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO income_detail_history (account_id, amount_cents, unit, effective_date, note) VALUES (?, ?, ?, ?, ?)',
    accountId,
    input.amountCents,
    input.unit,
    input.effectiveDate,
    input.note,
  );
  return result.lastInsertRowId;
}

export async function updateDetail(db: SQLiteDatabase, id: number, input: IncomeDetailInput): Promise<void> {
  await db.runAsync(
    'UPDATE income_detail_history SET amount_cents = ?, unit = ?, effective_date = ?, note = ? WHERE id = ?',
    input.amountCents,
    input.unit,
    input.effectiveDate,
    input.note,
    id,
  );
}

export async function deleteDetail(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM income_detail_history WHERE id = ?', id);
}
