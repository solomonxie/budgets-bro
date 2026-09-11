import type { SQLiteDatabase } from 'expo-sqlite';
import type { AccountRow } from '../schema';
import type { Account, AccountType } from '../../domain/types';
import { isLoanLikeType } from '../../domain/accountKind';
import { LIST_ACCOUNTS_WITH_BALANCES, LIST_CLOSED_ACCOUNTS_WITH_BALANCES } from '../../../databases/queries/accounts';
import * as categoriesRepo from './categoriesRepo';

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

export async function listAccountsWithBalances(db: SQLiteDatabase, boardId: number): Promise<AccountWithBalance[]> {
  const rows = await db.getAllAsync<AccountRow & { activity_cents: number }>(LIST_ACCOUNTS_WITH_BALANCES, boardId);
  return rows.map((row) => ({
    account: mapRow(row),
    balanceCents: row.opening_balance_cents + row.activity_cents,
  }));
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
  interestRateBps?: number | null;
  termMonths?: number | null;
  originalPrincipalCents?: number | null;
  originationDate?: string | null;
}

export async function createAccount(db: SQLiteDatabase, boardId: number, input: AccountInput): Promise<number> {
  const onBudget = input.type !== 'tracking' ? 1 : 0;
  const result = await db.runAsync(
    `INSERT INTO accounts (board_id, name, type, on_budget, opening_balance_cents, interest_rate_bps, term_months, original_principal_cents, origination_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    boardId,
    input.name,
    input.type,
    onBudget,
    input.openingBalanceCents,
    input.interestRateBps ?? null,
    input.termMonths ?? null,
    input.originalPrincipalCents ?? null,
    input.originationDate ?? null,
  );
  const id = result.lastInsertRowId;
  if (isLoanLikeType(input.type)) await categoriesRepo.ensurePaymentCategory(db, boardId, id, input.name);
  return id;
}

export async function updateAccount(db: SQLiteDatabase, boardId: number, id: number, input: AccountInput): Promise<void> {
  const onBudget = input.type !== 'tracking' ? 1 : 0;
  await db.runAsync(
    `UPDATE accounts SET name = ?, type = ?, on_budget = ?, opening_balance_cents = ?,
       interest_rate_bps = ?, term_months = ?, original_principal_cents = ?, origination_date = ?
     WHERE id = ?`,
    input.name,
    input.type,
    onBudget,
    input.openingBalanceCents,
    input.interestRateBps ?? null,
    input.termMonths ?? null,
    input.originalPrincipalCents ?? null,
    input.originationDate ?? null,
    id,
  );
  if (isLoanLikeType(input.type)) {
    await categoriesRepo.ensurePaymentCategory(db, boardId, id, input.name);
  } else {
    await categoriesRepo.archivePaymentCategory(db, id);
  }
}

export async function archiveAccount(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE accounts SET archived_at = datetime('now') WHERE id = ?", id);
  await categoriesRepo.archivePaymentCategory(db, id);
}

export async function listClosedAccounts(db: SQLiteDatabase, boardId: number): Promise<AccountWithBalance[]> {
  const rows = await db.getAllAsync<AccountRow & { activity_cents: number }>(LIST_CLOSED_ACCOUNTS_WITH_BALANCES, boardId);
  return rows.map((row) => ({
    account: mapRow(row),
    balanceCents: row.opening_balance_cents + row.activity_cents,
  }));
}

export async function reopenAccount(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE accounts SET archived_at = NULL WHERE id = ?', id);
}
