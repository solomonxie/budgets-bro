import type { SQLiteDatabase } from 'expo-sqlite';
import type { AccountRow } from '../schema';
import type { Account, AccountType } from '../../domain/types';
import { LIST_ACCOUNTS_WITH_BALANCES, LIST_CLOSED_ACCOUNTS_WITH_BALANCES } from '../../../databases/queries/accounts';
import { currentDateISO } from '../../domain/month';
import { usesLoggedValue } from '../../domain/accountKind';
import * as payeesRepo from './payeesRepo';
import * as accountValueHistoryRepo from './accountValueHistoryRepo';

function mapRow(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    onBudget: row.on_budget === 1,
    currency: row.currency,
    openingBalanceCents: row.opening_balance_cents,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    interestRateBps: row.interest_rate_bps,
    termMonths: row.term_months,
    originalPrincipalCents: row.original_principal_cents,
    originationDate: row.origination_date,
    originalHousePriceCents: row.original_house_price_cents,
  };
}

export async function listAccounts(db: SQLiteDatabase, boardId: number): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    'SELECT * FROM accounts WHERE archived_at IS NULL AND board_id = ? ORDER BY type, name',
    boardId,
  );
  return rows.map(mapRow);
}

export interface AccountWithBalance {
  account: Account;
  balanceCents: number;
}

// A tracking/asset account's "balance" is its latest logged value (see
// accountValueHistoryRepo/T8.6), not opening_balance + transactions — its
// transactions track real cash movement, but growth/decline is tracked
// separately via manual value-log entries. Falls back to the usual
// computed balance for one with no value entries logged yet (freshly
// created, only an opening balance).
function resolveBalanceCents(
  account: Account,
  computedBalanceCents: number,
  valuesByAccountId: Map<number, number>,
): number {
  if (!usesLoggedValue(account.type)) return computedBalanceCents;
  return valuesByAccountId.get(account.id) ?? computedBalanceCents;
}

export async function listAccountsWithBalances(db: SQLiteDatabase, boardId: number): Promise<AccountWithBalance[]> {
  const [rows, valuesByAccountId] = await Promise.all([
    db.getAllAsync<AccountRow & { activity_cents: number }>(LIST_ACCOUNTS_WITH_BALANCES, currentDateISO(), boardId),
    accountValueHistoryRepo.currentValuesByBoard(db, boardId),
  ]);
  return rows.map((row) => {
    const account = mapRow(row);
    return { account, balanceCents: resolveBalanceCents(account, row.opening_balance_cents + row.activity_cents, valuesByAccountId) };
  });
}

export async function getAccount(db: SQLiteDatabase, id: number): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', id);
  return row ? mapRow(row) : null;
}

// Matches a closed account too (deliberately no `archived_at IS NULL`
// filter) — this is the importer's match-or-create lookup, and a closed
// account whose transactions the user re-imports should still be found
// and reused, not silently duplicated into a brand-new open account.
export async function findAccountByName(db: SQLiteDatabase, boardId: number, name: string): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>(
    'SELECT * FROM accounts WHERE name = ? AND board_id = ?',
    name,
    boardId,
  );
  return row ? mapRow(row) : null;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  openingBalanceCents: number;
  // Loan/mortgage terms — undefined/null for every other account type.
  // interestRateBps is legacy passthrough only (kept for the initial rate
  // history seed row at creation) — see accountRateHistoryRepo for edits.
  interestRateBps?: number | null;
  termMonths?: number | null;
  originalPrincipalCents?: number | null;
  originationDate?: string | null;
  originalHousePriceCents?: number | null;
}

export async function createAccount(db: SQLiteDatabase, boardId: number, input: AccountInput): Promise<number> {
  const onBudget = usesLoggedValue(input.type) ? 0 : 1;
  const result = await db.runAsync(
    `INSERT INTO accounts (board_id, name, type, on_budget, opening_balance_cents, interest_rate_bps, term_months, original_principal_cents, origination_date, original_house_price_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    boardId,
    input.name,
    input.type,
    onBudget,
    input.openingBalanceCents,
    input.interestRateBps ?? null,
    input.termMonths ?? null,
    input.originalPrincipalCents ?? null,
    input.originationDate ?? null,
    input.originalHousePriceCents ?? null,
  );
  const id = result.lastInsertRowId;
  await payeesRepo.ensureAccountPayee(db, boardId, id, input.name);
  return id;
}

export async function updateAccount(db: SQLiteDatabase, boardId: number, id: number, input: AccountInput): Promise<void> {
  const onBudget = usesLoggedValue(input.type) ? 0 : 1;
  await db.runAsync(
    `UPDATE accounts SET name = ?, type = ?, on_budget = ?, opening_balance_cents = ?,
       term_months = ?, original_principal_cents = ?, origination_date = ?, original_house_price_cents = ?
     WHERE id = ?`,
    input.name,
    input.type,
    onBudget,
    input.openingBalanceCents,
    input.termMonths ?? null,
    input.originalPrincipalCents ?? null,
    input.originationDate ?? null,
    input.originalHousePriceCents ?? null,
    id,
  );
  await payeesRepo.ensureAccountPayee(db, boardId, id, input.name);
}

export async function archiveAccount(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE accounts SET archived_at = datetime('now') WHERE id = ?", id);
  await payeesRepo.unlinkAccountPayee(db, id);
}

export async function listClosedAccounts(db: SQLiteDatabase, boardId: number): Promise<AccountWithBalance[]> {
  const [rows, valuesByAccountId] = await Promise.all([
    db.getAllAsync<AccountRow & { activity_cents: number }>(LIST_CLOSED_ACCOUNTS_WITH_BALANCES, currentDateISO(), boardId),
    accountValueHistoryRepo.currentValuesByBoard(db, boardId),
  ]);
  return rows.map((row) => {
    const account = mapRow(row);
    return { account, balanceCents: resolveBalanceCents(account, row.opening_balance_cents + row.activity_cents, valuesByAccountId) };
  });
}

export async function reopenAccount(db: SQLiteDatabase, boardId: number, id: number): Promise<void> {
  await db.runAsync('UPDATE accounts SET archived_at = NULL WHERE id = ?', id);
  const account = await getAccount(db, id);
  if (account) await payeesRepo.ensureAccountPayee(db, boardId, id, account.name);
}
