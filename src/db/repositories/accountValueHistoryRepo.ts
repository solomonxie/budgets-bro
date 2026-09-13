import type { SQLiteDatabase } from 'expo-sqlite';
import type { AccountValueHistoryRow } from '../schema';
import type { AccountValueChange } from '../../domain/types';
import {
  LIST_VALUE_HISTORY,
  CURRENT_VALUE,
  CURRENT_VALUES_FOR_BOARD,
} from '../../../databases/queries/accountValueHistory';

function mapRow(row: AccountValueHistoryRow): AccountValueChange {
  return { id: row.id, accountId: row.account_id, valueCents: row.value_cents, effectiveDate: row.effective_date };
}

export async function listValueHistory(db: SQLiteDatabase, accountId: number): Promise<AccountValueChange[]> {
  const rows = await db.getAllAsync<AccountValueHistoryRow>(LIST_VALUE_HISTORY, accountId);
  return rows.map(mapRow);
}

// Most recent by effective date — same "backdated correction stays in
// order" rule as accountRateHistoryRepo.currentRateBps.
export async function currentValueCents(db: SQLiteDatabase, accountId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ value_cents: number }>(CURRENT_VALUE, accountId);
  return row?.value_cents ?? null;
}

// Board-wide latest value per account — feeds the Net Worth rollup (mortgage
// house value) and a tracking account's displayed balance (see
// accountsRepo.listAccountsWithBalances) without an N+1 query per account.
export async function currentValuesByBoard(db: SQLiteDatabase, boardId: number): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ account_id: number; value_cents: number }>(CURRENT_VALUES_FOR_BOARD, boardId);
  return new Map(rows.map((r) => [r.account_id, r.value_cents]));
}

export async function addValueChange(db: SQLiteDatabase, accountId: number, valueCents: number, effectiveDate: string): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO account_value_history (account_id, value_cents, effective_date) VALUES (?, ?, ?)',
    accountId,
    valueCents,
    effectiveDate,
  );
  return result.lastInsertRowId;
}

export async function updateValueChange(db: SQLiteDatabase, id: number, valueCents: number, effectiveDate: string): Promise<void> {
  await db.runAsync('UPDATE account_value_history SET value_cents = ?, effective_date = ? WHERE id = ?', valueCents, effectiveDate, id);
}

export async function deleteValueChange(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM account_value_history WHERE id = ?', id);
}

// Folds one account's whole value log into another's (T8.3: merging a
// tracking account's value history into a mortgage account) — a straight
// re-point, no row transformation needed since both sides share this table.
export async function reassignAccount(db: SQLiteDatabase, fromAccountId: number, toAccountId: number): Promise<void> {
  await db.runAsync('UPDATE account_value_history SET account_id = ? WHERE account_id = ?', toAccountId, fromAccountId);
}
