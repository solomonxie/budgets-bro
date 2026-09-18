import type { SQLiteDatabase } from '../../db/driver';
import type { AccountRateHistoryRow } from '../schema';
import type { AccountRateChange } from '../../domain/types';
import { LIST_RATE_HISTORY, CURRENT_RATE, CURRENT_RATES_FOR_BOARD } from '../../../databases/queries/accountRateHistory';

function mapRow(row: AccountRateHistoryRow): AccountRateChange {
  return { id: row.id, accountId: row.account_id, rateBps: row.rate_bps, effectiveDate: row.effective_date, note: row.note };
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

export async function currentRatesByBoard(db: SQLiteDatabase, boardId: number): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ account_id: number; rate_bps: number }>(CURRENT_RATES_FOR_BOARD, boardId);
  return new Map(rows.map((r) => [r.account_id, r.rate_bps]));
}

export async function addRateChange(
  db: SQLiteDatabase,
  accountId: number,
  rateBps: number,
  effectiveDate: string,
  note: string | null = null,
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO account_rate_history (account_id, rate_bps, effective_date, note) VALUES (?, ?, ?, ?)',
    accountId,
    rateBps,
    effectiveDate,
    note,
  );
  return result.lastInsertRowId;
}

export async function updateRateChange(
  db: SQLiteDatabase,
  id: number,
  rateBps: number,
  effectiveDate: string,
  note: string | null = null,
): Promise<void> {
  await db.runAsync(
    'UPDATE account_rate_history SET rate_bps = ?, effective_date = ?, note = ? WHERE id = ?',
    rateBps,
    effectiveDate,
    note,
    id,
  );
}

export async function deleteRateChange(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM account_rate_history WHERE id = ?', id);
}
