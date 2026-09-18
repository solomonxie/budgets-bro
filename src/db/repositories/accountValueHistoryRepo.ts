import type { SQLiteDatabase } from '../../db/driver';
import type { AccountValueHistoryRow } from '../schema';
import type { AccountValueChange, AccountValueKind } from '../../domain/types';
import {
  LIST_VALUE_HISTORY,
  CURRENT_VALUE,
  CURRENT_VALUES_FOR_BOARD,
} from '../../../databases/queries/accountValueHistory';

function mapRow(row: AccountValueHistoryRow): AccountValueChange {
  return {
    id: row.id,
    accountId: row.account_id,
    valueCents: row.value_cents,
    effectiveDate: row.effective_date,
    kind: row.kind as AccountValueKind,
    note: row.note,
  };
}

export async function listValueHistory(
  db: SQLiteDatabase,
  accountId: number,
  kind: AccountValueKind = 'value',
): Promise<AccountValueChange[]> {
  const rows = await db.getAllAsync<AccountValueHistoryRow>(LIST_VALUE_HISTORY, accountId, kind);
  return rows.map(mapRow);
}

// Most recent by effective date — same "backdated correction stays in
// order" rule as accountRateHistoryRepo.currentRateBps.
export async function currentValueCents(
  db: SQLiteDatabase,
  accountId: number,
  kind: AccountValueKind = 'value',
): Promise<number | null> {
  const row = await db.getFirstAsync<{ value_cents: number }>(CURRENT_VALUE, accountId, kind);
  return row?.value_cents ?? null;
}

// Board-wide latest value per account — feeds the Net Worth rollup (mortgage
// house value) and a tracking account's displayed balance (see
// accountsRepo.listAccountsWithBalances) without an N+1 query per account.
export async function currentValuesByBoard(
  db: SQLiteDatabase,
  boardId: number,
  kind: AccountValueKind = 'value',
): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ account_id: number; value_cents: number }>(CURRENT_VALUES_FOR_BOARD, boardId, kind);
  return new Map(rows.map((r) => [r.account_id, r.value_cents]));
}

export interface DatedReading {
  valueCents: number;
  effectiveDate: string;
}

// Latest reading *with its date* per account — deriving a loan's remaining
// principal needs to know which payments came after the reading, not just
// what it said (see finance-tools/remainingPrincipal).
export async function currentReadingsByBoard(
  db: SQLiteDatabase,
  boardId: number,
  kind: AccountValueKind,
): Promise<Map<number, DatedReading>> {
  const rows = await db.getAllAsync<{ account_id: number; value_cents: number; effective_date: string }>(
    CURRENT_VALUES_FOR_BOARD,
    boardId,
    kind,
  );
  return new Map(rows.map((r) => [r.account_id, { valueCents: r.value_cents, effectiveDate: r.effective_date }]));
}

export async function addValueChange(
  db: SQLiteDatabase,
  accountId: number,
  valueCents: number,
  effectiveDate: string,
  note: string | null = null,
  kind: AccountValueKind = 'value',
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO account_value_history (account_id, value_cents, effective_date, note, kind) VALUES (?, ?, ?, ?, ?)',
    accountId,
    valueCents,
    effectiveDate,
    note,
    kind,
  );
  return result.lastInsertRowId;
}

export async function updateValueChange(
  db: SQLiteDatabase,
  id: number,
  valueCents: number,
  effectiveDate: string,
  note: string | null = null,
): Promise<void> {
  await db.runAsync(
    'UPDATE account_value_history SET value_cents = ?, effective_date = ?, note = ? WHERE id = ?',
    valueCents,
    effectiveDate,
    note,
    id,
  );
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
