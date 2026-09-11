import type { SQLiteDatabase } from 'expo-sqlite';
import type { AccountRateHistoryRow } from '../schema';
import type { AccountRateChange } from '../../domain/types';
import { LIST_RATE_HISTORY, CURRENT_RATE } from '../../../databases/queries/accountRateHistory';

function mapRow(row: AccountRateHistoryRow): AccountRateChange {
  return { id: row.id, accountId: row.account_id, rateBps: row.rate_bps, effectiveDate: row.effective_date };
}

export async function listRateHistory(db: SQLiteDatabase, accountId: number): Promise<AccountRateChange[]> {
  const rows = await db.getAllAsync<AccountRateHistoryRow>(LIST_RATE_HISTORY, accountId);
  return rows.map(mapRow);
}

// Most recent by effective date — the rate that actually applies today,
// regardless of insertion order (a backdated correction stays ordered by
// its effective_date, not when it was entered).
export async function currentRateBps(db: SQLiteDatabase, accountId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ rate_bps: number }>(CURRENT_RATE, accountId);
  return row?.rate_bps ?? null;
}

export async function addRateChange(db: SQLiteDatabase, accountId: number, rateBps: number, effectiveDate: string): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO account_rate_history (account_id, rate_bps, effective_date) VALUES (?, ?, ?)',
    accountId,
    rateBps,
    effectiveDate,
  );
  return result.lastInsertRowId;
}

export async function updateRateChange(db: SQLiteDatabase, id: number, rateBps: number, effectiveDate: string): Promise<void> {
  await db.runAsync('UPDATE account_rate_history SET rate_bps = ?, effective_date = ? WHERE id = ?', rateBps, effectiveDate, id);
}

export async function deleteRateChange(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM account_rate_history WHERE id = ?', id);
}
