import type { SQLiteDatabase } from 'expo-sqlite';
import type { AccountRow } from '../schema';
import type { Account, AccountType } from '../../domain/types';

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
  };
}

export async function listAccounts(db: SQLiteDatabase): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    'SELECT * FROM accounts WHERE archived_at IS NULL ORDER BY type, name',
  );
  return rows.map(mapRow);
}

export interface AccountWithBalance {
  account: Account;
  balanceCents: number;
}

export async function listAccountsWithBalances(db: SQLiteDatabase): Promise<AccountWithBalance[]> {
  const rows = await db.getAllAsync<AccountRow & { activity_cents: number }>(
    `SELECT a.*, COALESCE(SUM(t.amount_cents), 0) as activity_cents
     FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id
     WHERE a.archived_at IS NULL
     GROUP BY a.id
     ORDER BY a.type, a.name`,
  );
  return rows.map((row) => ({
    account: mapRow(row),
    balanceCents: row.opening_balance_cents + row.activity_cents,
  }));
}

export async function getAccount(db: SQLiteDatabase, id: number): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', id);
  return row ? mapRow(row) : null;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  openingBalanceCents: number;
}

export async function createAccount(db: SQLiteDatabase, input: AccountInput): Promise<number> {
  const onBudget = input.type !== 'tracking' ? 1 : 0;
  const result = await db.runAsync(
    'INSERT INTO accounts (name, type, on_budget, opening_balance_cents) VALUES (?, ?, ?, ?)',
    input.name,
    input.type,
    onBudget,
    input.openingBalanceCents,
  );
  return result.lastInsertRowId;
}

export async function updateAccount(db: SQLiteDatabase, id: number, input: AccountInput): Promise<void> {
  const onBudget = input.type !== 'tracking' ? 1 : 0;
  await db.runAsync(
    'UPDATE accounts SET name = ?, type = ?, on_budget = ?, opening_balance_cents = ? WHERE id = ?',
    input.name,
    input.type,
    onBudget,
    input.openingBalanceCents,
    id,
  );
}

export async function archiveAccount(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE accounts SET archived_at = datetime('now') WHERE id = ?", id);
}
