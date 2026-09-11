import type { SQLiteDatabase } from 'expo-sqlite';
import type { AccountHouseValueHistoryRow } from '../schema';
import type { AccountHouseValueChange } from '../../domain/types';
import {
  LIST_HOUSE_VALUE_HISTORY,
  CURRENT_HOUSE_VALUE,
  CURRENT_HOUSE_VALUES_FOR_BOARD,
} from '../../../databases/queries/accountHouseValueHistory';

function mapRow(row: AccountHouseValueHistoryRow): AccountHouseValueChange {
  return { id: row.id, accountId: row.account_id, valueCents: row.value_cents, effectiveDate: row.effective_date };
}

export async function listHouseValueHistory(db: SQLiteDatabase, accountId: number): Promise<AccountHouseValueChange[]> {
  const rows = await db.getAllAsync<AccountHouseValueHistoryRow>(LIST_HOUSE_VALUE_HISTORY, accountId);
  return rows.map(mapRow);
}

// Most recent by effective date — same "backdated correction stays in
// order" rule as accountRateHistoryRepo.currentRateBps.
export async function currentHouseValueCents(db: SQLiteDatabase, accountId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ value_cents: number }>(CURRENT_HOUSE_VALUE, accountId);
  return row?.value_cents ?? null;
}

// Board-wide latest value per mortgage account — feeds the Net Worth
// rollup without an N+1 query per account.
export async function currentHouseValuesByBoard(db: SQLiteDatabase, boardId: number): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ account_id: number; value_cents: number }>(CURRENT_HOUSE_VALUES_FOR_BOARD, boardId);
  return new Map(rows.map((r) => [r.account_id, r.value_cents]));
}

export async function addValueChange(db: SQLiteDatabase, accountId: number, valueCents: number, effectiveDate: string): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO account_house_value_history (account_id, value_cents, effective_date) VALUES (?, ?, ?)',
    accountId,
    valueCents,
    effectiveDate,
  );
  return result.lastInsertRowId;
}

export async function updateValueChange(db: SQLiteDatabase, id: number, valueCents: number, effectiveDate: string): Promise<void> {
  await db.runAsync('UPDATE account_house_value_history SET value_cents = ?, effective_date = ? WHERE id = ?', valueCents, effectiveDate, id);
}

export async function deleteValueChange(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM account_house_value_history WHERE id = ?', id);
}
