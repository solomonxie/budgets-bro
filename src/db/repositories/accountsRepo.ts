import type { SQLiteDatabase } from '../../db/driver';
import type { AccountRow } from '../schema';
import type { Account, AccountType } from '../../domain/types';
import { LIST_ACCOUNTS_WITH_BALANCES, LIST_CLOSED_ACCOUNTS_WITH_BALANCES, LOAN_PAYMENTS_FOR_BOARD } from '../../../databases/queries/accounts';
import { currentDateISO } from '../../domain/month';
import { isLoanLikeType, usesLoggedValue } from '../../domain/accountKind';
import { remainingPrincipal } from '../../finance-tools/remainingPrincipal';
import { planAbsorb } from '../../domain/absorbAccount';
import type { ActualPayment } from '../../finance-tools/paymentSplit';
import * as payeesRepo from './payeesRepo';
import * as accountRateHistoryRepo from './accountRateHistoryRepo';
import * as accountValueHistoryRepo from './accountValueHistoryRepo';
import type { DatedReading } from './accountValueHistoryRepo';

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
    note: row.note,
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

// Three account shapes, three definitions of "balance":
//
// - tracking/asset: its latest logged value (see accountValueHistoryRepo),
//   not opening_balance + transactions. Its transactions track real cash
//   movement, but growth/decline is logged by hand.
// - loan/mortgage: the remaining principal, derived — each real payment
//   covers its period's interest first, so summing the payments would pay
//   the loan off years early (see finance-tools/remainingPrincipal). Stored
//   negative, like any debt.
// - everything else: opening_balance + transactions.
//
// Each falls back to the computed balance when it has nothing better to go
// on (a freshly created account with only an opening balance).
interface DerivedBalanceSources {
  valuesByAccountId: Map<number, number>;
  principalsByAccountId: Map<number, DatedReading>;
  ratesByAccountId: Map<number, number>;
  paymentsByAccountId: Map<number, ActualPayment[]>;
}

function resolveBalanceCents(account: Account, computedBalanceCents: number, sources: DerivedBalanceSources): number {
  if (usesLoggedValue(account.type)) return sources.valuesByAccountId.get(account.id) ?? computedBalanceCents;
  if (!isLoanLikeType(account.type)) return computedBalanceCents;
  const { owedCents } = remainingPrincipal({
    loggedPrincipal: sources.principalsByAccountId.get(account.id) ?? null,
    originalPrincipalCents: account.originalPrincipalCents,
    originationDate: account.originationDate,
    openingBalanceCents: account.openingBalanceCents,
    fallbackDate: account.createdAt.slice(0, 10),
    annualRateBps: sources.ratesByAccountId.get(account.id) ?? null,
    payments: sources.paymentsByAccountId.get(account.id) ?? [],
  });
  return -owedCents;
}

async function derivedBalanceSources(db: SQLiteDatabase, boardId: number): Promise<DerivedBalanceSources> {
  const [valuesByAccountId, principalsByAccountId, ratesByAccountId, paymentRows] = await Promise.all([
    accountValueHistoryRepo.currentValuesByBoard(db, boardId),
    accountValueHistoryRepo.currentReadingsByBoard(db, boardId, 'principal'),
    accountRateHistoryRepo.currentRatesByBoard(db, boardId),
    db.getAllAsync<{ account_id: number; amount_cents: number; date: string }>(LOAN_PAYMENTS_FOR_BOARD, boardId, currentDateISO()),
  ]);
  const paymentsByAccountId = new Map<number, ActualPayment[]>();
  for (const row of paymentRows) {
    const list = paymentsByAccountId.get(row.account_id) ?? [];
    list.push({ date: row.date, amountCents: row.amount_cents });
    paymentsByAccountId.set(row.account_id, list);
  }
  return { valuesByAccountId, principalsByAccountId, ratesByAccountId, paymentsByAccountId };
}

export async function listAccountsWithBalances(db: SQLiteDatabase, boardId: number): Promise<AccountWithBalance[]> {
  const [rows, sources] = await Promise.all([
    db.getAllAsync<AccountRow & { activity_cents: number }>(LIST_ACCOUNTS_WITH_BALANCES, currentDateISO(), boardId),
    derivedBalanceSources(db, boardId),
  ]);
  return rows.map((row) => {
    const account = mapRow(row);
    return { account, balanceCents: resolveBalanceCents(account, row.opening_balance_cents + row.activity_cents, sources) };
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
  note?: string | null;
}

export async function createAccount(db: SQLiteDatabase, boardId: number, input: AccountInput): Promise<number> {
  const onBudget = usesLoggedValue(input.type) ? 0 : 1;
  const result = await db.runAsync(
    `INSERT INTO accounts (board_id, name, type, on_budget, opening_balance_cents, interest_rate_bps, term_months, original_principal_cents, origination_date, original_house_price_cents, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    input.note ?? null,
  );
  const id = result.lastInsertRowId;
  await payeesRepo.ensureAccountPayee(db, boardId, id, input.name);
  return id;
}

export async function updateAccount(db: SQLiteDatabase, boardId: number, id: number, input: AccountInput): Promise<void> {
  const onBudget = usesLoggedValue(input.type) ? 0 : 1;
  await db.runAsync(
    `UPDATE accounts SET name = ?, type = ?, on_budget = ?, opening_balance_cents = ?,
       term_months = ?, original_principal_cents = ?, origination_date = ?, original_house_price_cents = ?, note = ?
     WHERE id = ?`,
    input.name,
    input.type,
    onBudget,
    input.openingBalanceCents,
    input.termMonths ?? null,
    input.originalPrincipalCents ?? null,
    input.originationDate ?? null,
    input.originalHousePriceCents ?? null,
    input.note ?? null,
    id,
  );
  await payeesRepo.ensureAccountPayee(db, boardId, id, input.name);
}

export async function archiveAccount(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE accounts SET archived_at = datetime('now') WHERE id = ?", id);
  await payeesRepo.unlinkAccountPayee(db, id);
}

export async function listClosedAccounts(db: SQLiteDatabase, boardId: number): Promise<AccountWithBalance[]> {
  const [rows, sources] = await Promise.all([
    db.getAllAsync<AccountRow & { activity_cents: number }>(LIST_CLOSED_ACCOUNTS_WITH_BALANCES, currentDateISO(), boardId),
    derivedBalanceSources(db, boardId),
  ]);
  return rows.map((row) => {
    const account = mapRow(row);
    return { account, balanceCents: resolveBalanceCents(account, row.opening_balance_cents + row.activity_cents, sources) };
  });
}

export async function reopenAccount(db: SQLiteDatabase, boardId: number, id: number): Promise<void> {
  await db.runAsync('UPDATE accounts SET archived_at = NULL WHERE id = ?', id);
  const account = await getAccount(db, id);
  if (account) await payeesRepo.ensureAccountPayee(db, boardId, id, account.name);
}

// Removes a closed account and everything that only existed because of it.
// Archiving hides an account but keeps its transactions, and those keep
// counting: a categorised transaction on an archived account still counts as
// category activity (databases/queries/budgets.ts filters on on_budget, not
// on archived_at) while the account's own balance is dropped from the cash
// side. An account closed with categorised spending on it therefore drags
// category balances — and so Unassigned Cash — down for good.
//
// Deleting is the honest way out when the account's history isn't wanted.
// Everything that points at it is dealt with rather than left dangling:
//   - its own transactions go;
//   - the other half of any transfer keeps its row but loses the link, since
//     that money really did leave the other account;
//   - its rate and value history go, its payee is unlinked and removed, and
//     any goal pointing at it loses the link.
//
// Irreversible, which is why it is offered only for an already-closed
// account and behind a confirmation that says what it takes with it.
export async function deleteAccountPermanently(db: SQLiteDatabase, accountId: number): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE account_id = ?',
    accountId,
  );
  const transactionCount = row?.count ?? 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE transactions SET transfer_account_id = NULL WHERE transfer_account_id = ?', accountId);
    await db.runAsync('DELETE FROM transactions WHERE account_id = ?', accountId);
    await db.runAsync('DELETE FROM scheduled_transactions WHERE account_id = ?', accountId);
    await db.runAsync('DELETE FROM account_rate_history WHERE account_id = ?', accountId);
    await db.runAsync('DELETE FROM account_value_history WHERE account_id = ?', accountId);
    await db.runAsync('UPDATE custom_goals SET linked_account_id = NULL WHERE linked_account_id = ?', accountId);
    await db.runAsync('UPDATE transactions SET payee_id = NULL WHERE payee_id IN (SELECT id FROM payees WHERE linked_account_id = ?)', accountId);
    await db.runAsync('DELETE FROM payees WHERE linked_account_id = ?', accountId);
    await db.runAsync('DELETE FROM accounts WHERE id = ?', accountId);
  });
  return transactionCount;
}

// What deleting this account would do to Unassigned Cash, before doing it.
//
// Unassigned is cash minus the sum of category balances, so removing a row
// that carried a category removes its amount from activity and moves
// Unassigned the opposite way. For a credit card that matters enormously and
// counter-intuitively: card spending is what offsets the cash that later
// paid the card off, so deleting the card takes the spending away and leaves
// the payments behind, and Unassigned falls by everything ever spent on it.
//
// Returned as the delta Unassigned would move by, so the confirmation can
// show it rather than let the user find out afterwards.
export async function unassignedImpactOfDeleting(db: SQLiteDatabase, accountId: number): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(t.amount_cents), 0) as total FROM transactions t
     JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
     WHERE t.account_id = ? AND t.category_id IS NOT NULL`,
    accountId,
  );
  // Removing activity of -X raises the category sum by X, which lowers
  // Unassigned by X — so the delta is the activity itself.
  return row?.total ?? 0;
}

// Which account paid this one off — the other side of its transfers, by
// weight, so the obvious answer wins when there are a few stray ones. Null
// when the account never transferred with anything, in which case there is
// nothing to absorb into and deleting is the only option.
export async function likelyAbsorbingAccountId(db: SQLiteDatabase, accountId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ transfer_account_id: number }>(
    `SELECT transfer_account_id, COUNT(*) as n FROM transactions
     WHERE account_id = ? AND transfer_account_id IS NOT NULL
     GROUP BY transfer_account_id ORDER BY n DESC LIMIT 1`,
    accountId,
  );
  return row?.transfer_account_id ?? null;
}

export interface AbsorbOutcome {
  moved: number;
  collapsed: number;
  balanceDeltaCents: number;
}

// Deletes an account by moving its history onto the account that paid it,
// rather than throwing the history away. See domain/absorbAccount for why
// the transfers between the two have to go with it — without that the
// absorbing account ends up holding both the spending and the payments for
// it, which is the same money twice.
export async function absorbAccountInto(
  db: SQLiteDatabase,
  accountId: number,
  intoAccountId: number,
): Promise<AbsorbOutcome> {
  const rows = await db.getAllAsync<{
    id: number;
    account_id: number;
    transfer_account_id: number | null;
    category_id: number | null;
    amount_cents: number;
  }>(
    `SELECT id, account_id, transfer_account_id, category_id, amount_cents FROM transactions
     WHERE account_id IN (?, ?) OR transfer_account_id IN (?, ?)`,
    accountId,
    intoAccountId,
    accountId,
    intoAccountId,
  );
  const plan = planAbsorb(
    rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      transferAccountId: r.transfer_account_id,
      categoryId: r.category_id,
      amountCents: r.amount_cents,
    })),
    accountId,
    intoAccountId,
  );

  await db.withTransactionAsync(async () => {
    if (plan.deleteIds.length > 0) {
      await db.runAsync(`DELETE FROM transactions WHERE id IN (${plan.deleteIds.map(() => '?').join(', ')})`, ...plan.deleteIds);
    }
    if (plan.moveIds.length > 0) {
      await db.runAsync(
        `UPDATE transactions SET account_id = ?, transfer_account_id = NULL, updated_at = datetime('now')
         WHERE id IN (${plan.moveIds.map(() => '?').join(', ')})`,
        intoAccountId,
        ...plan.moveIds,
      );
    }
    await db.runAsync('UPDATE transactions SET transfer_account_id = NULL WHERE transfer_account_id = ?', accountId);
    await db.runAsync('DELETE FROM scheduled_transactions WHERE account_id = ?', accountId);
    await db.runAsync('DELETE FROM account_rate_history WHERE account_id = ?', accountId);
    await db.runAsync('DELETE FROM account_value_history WHERE account_id = ?', accountId);
    await db.runAsync('UPDATE custom_goals SET linked_account_id = NULL WHERE linked_account_id = ?', accountId);
    await db.runAsync('DELETE FROM payees WHERE linked_account_id = ?', accountId);
    await db.runAsync('DELETE FROM accounts WHERE id = ?', accountId);
  });

  return { moved: plan.moveIds.length, collapsed: plan.deleteIds.length, balanceDeltaCents: plan.balanceDeltaCents };
}
