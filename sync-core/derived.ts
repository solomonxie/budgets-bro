import type { AccountType } from './accountKind';
import { isLoanLikeType, toppedUpByContributions, usesLoggedValue } from './accountKind';
import {
  categoryBalanceCents,
  categoryCaption,
  categoryFundedCents,
  categoryStatus,
  unassignedCashCents,
} from './budget';
import type { CategoryStatus } from './budget';
import { nextMonth } from './month';
import { remainingPrincipal } from './remainingPrincipal';
import type { ActualPayment } from './paymentSplit';

// The phone's budget and balance SQL (databases/queries/budgets.ts,
// accounts.ts), as plain functions over rows — for a reader with no SQLite
// (the extension). Ids are whatever the caller keys rows by: gids there, local
// ids in the parity test. `tie` breaks same-day history readings the way the
// phone's `id DESC` does; pass something that grows with insertion order.

export interface AccountRec {
  id: string;
  type: AccountType;
  on_budget: number;
  opening_balance_cents: number;
  archived_at: string | null;
  created_at: string;
  original_principal_cents: number | null;
  origination_date: string | null;
  term_months: number | null;
}

export interface TxnRec {
  account_id: string;
  category_id: string | null;
  amount_cents: number;
  date: string;
  tie?: string | number;
}

export interface EntryRec {
  category_id: string;
  month: string;
  assigned_cents: number;
}

export interface ValueRec {
  account_id: string;
  kind: string;
  value_cents: number;
  effective_date: string;
  tie: string | number;
}

export interface RateRec {
  account_id: string;
  rate_bps: number;
  effective_date: string;
  tie: string | number;
}

export interface CategoryFigures {
  assignedThisMonthCents: number;
  activityThisMonthCents: number;
  balanceCents: number;
  fundedCents: number;
  status: CategoryStatus;
  captionText: string;
}

const add = (map: Map<string, number>, key: string, cents: number) =>
  map.set(key, (map.get(key) ?? 0) + cents);

const onBudgetIds = (accounts: AccountRec[]) =>
  new Set(accounts.filter((a) => a.on_budget === 1).map((a) => a.id));

// useBudget's per-category figures for `month`.
export function categoryFigures(
  categoryIds: string[],
  accounts: AccountRec[],
  entries: EntryRec[],
  txns: TxnRec[],
  month: string,
  today: string,
): Map<string, CategoryFigures> {
  const start = `${month}-01`;
  const end = `${nextMonth(month)}-01`;
  const onBudget = onBudgetIds(accounts);
  const cumAssigned = new Map<string, number>();
  const thisAssigned = new Map<string, number>();
  const cumActivity = new Map<string, number>();
  const thisActivity = new Map<string, number>();
  for (const e of entries) {
    if (e.month <= month) add(cumAssigned, e.category_id, e.assigned_cents);
    if (e.month === month) add(thisAssigned, e.category_id, e.assigned_cents);
  }
  for (const t of txns) {
    if (t.category_id == null || !onBudget.has(t.account_id)) continue;
    if (t.date >= end || t.date > today) continue;
    add(cumActivity, t.category_id, t.amount_cents);
    if (t.date >= start) add(thisActivity, t.category_id, t.amount_cents);
  }
  const out = new Map<string, CategoryFigures>();
  for (const id of categoryIds) {
    const balanceCents = categoryBalanceCents(cumAssigned.get(id) ?? 0, cumActivity.get(id) ?? 0);
    const activityThisMonthCents = thisActivity.get(id) ?? 0;
    const fundedCents = categoryFundedCents(balanceCents, activityThisMonthCents);
    const status = categoryStatus(balanceCents, fundedCents);
    out.set(id, {
      assignedThisMonthCents: thisAssigned.get(id) ?? 0,
      activityThisMonthCents,
      balanceCents,
      fundedCents,
      status,
      captionText: categoryCaption(status, Math.max(0, -activityThisMonthCents), fundedCents),
    });
  }
  return out;
}

export interface UnassignedBreakdown {
  cashCents: number;
  envelopesCents: number;
  assignedAheadCents: number;
  unassignedCents: number;
  cardDebtCents: number;
}

// budgetsRepo.unassignedBreakdown: cash and activity as of today, every
// month's assignments.
export function unassignedBreakdown(
  accounts: AccountRec[],
  entries: EntryRec[],
  txns: TxnRec[],
  today: string,
): UnassignedBreakdown {
  const current = today.slice(0, 7);
  const end = `${nextMonth(current)}-01`;
  const onBudget = onBudgetIds(accounts);
  const typeOf = new Map(accounts.filter((a) => a.archived_at == null).map((a) => [a.id, a.type]));
  let assigned = 0;
  let assignedAheadCents = 0;
  for (const e of entries) {
    assigned += e.assigned_cents;
    if (e.month > current) assignedAheadCents += e.assigned_cents;
  }
  let cashCents = 0;
  let cardCents = 0;
  for (const a of accounts) {
    if (a.archived_at != null) continue;
    if (a.type === 'cash') cashCents += a.opening_balance_cents;
    if (a.type === 'credit_card') cardCents += a.opening_balance_cents;
  }
  let activity = 0;
  for (const t of txns) {
    if (t.date >= end || t.date > today) continue;
    if (t.category_id != null && onBudget.has(t.account_id)) activity += t.amount_cents;
    const type = typeOf.get(t.account_id);
    if (type === 'cash') cashCents += t.amount_cents;
    if (type === 'credit_card') cardCents += t.amount_cents;
  }
  const envelopesCents = categoryBalanceCents(assigned, activity);
  return {
    cashCents,
    envelopesCents,
    assignedAheadCents,
    unassignedCents: unassignedCashCents(cashCents, envelopesCents),
    cardDebtCents: Math.max(0, -cardCents),
  };
}

const later = (a: { effective_date: string; tie: string | number }, b: typeof a) =>
  a.effective_date !== b.effective_date ? a.effective_date > b.effective_date : a.tie > b.tie;

function latestBy<T extends { account_id: string; effective_date: string; tie: string | number }>(
  rows: T[],
  keep: (r: T) => boolean,
): Map<string, T> {
  const out = new Map<string, T>();
  for (const r of rows) {
    if (!keep(r)) continue;
    const seen = out.get(r.account_id);
    if (!seen || later(r, seen)) out.set(r.account_id, r);
  }
  return out;
}

// accountsRepo.listAccountsWithBalances / listClosedAccounts: one balance per
// account, by the rule for its type (see resolveBalanceCents there).
export function accountBalances(
  accounts: AccountRec[],
  txns: TxnRec[],
  values: ValueRec[],
  rates: RateRec[],
  today: string,
): Map<string, number> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const latestValue = latestBy(values, (v) => v.kind === 'value' && v.effective_date <= today);
  const latestPrincipal = latestBy(values, (v) => v.kind === 'principal' && v.effective_date <= today);
  const latestRate = latestBy(rates, () => true);

  const activity = new Map<string, number>();
  const paidInSinceValue = new Map<string, number>();
  const payments = new Map<string, (ActualPayment & { tie: string | number })[]>();
  for (const t of txns) {
    if (t.date > today) continue;
    const account = byId.get(t.account_id);
    if (!account) continue;
    add(activity, t.account_id, t.amount_cents);
    if (t.date > (latestValue.get(t.account_id)?.effective_date ?? ''))
      add(paidInSinceValue, t.account_id, t.amount_cents);
    if (isLoanLikeType(account.type)) {
      const list = payments.get(t.account_id) ?? [];
      list.push({ date: t.date, amountCents: t.amount_cents, tie: t.tie ?? 0 });
      payments.set(t.account_id, list);
    }
  }

  const out = new Map<string, number>();
  for (const a of accounts) {
    const computed = a.opening_balance_cents + (activity.get(a.id) ?? 0);
    const logged = latestValue.get(a.id)?.value_cents;
    let balance = computed;
    if (toppedUpByContributions(a.type)) {
      if (logged != null) balance = logged + (paidInSinceValue.get(a.id) ?? 0);
    } else if (usesLoggedValue(a.type)) {
      balance = logged ?? computed;
    } else if (isLoanLikeType(a.type)) {
      const principal = latestPrincipal.get(a.id);
      const list = (payments.get(a.id) ?? []).sort((x, y) =>
        x.date !== y.date ? (x.date < y.date ? -1 : 1) : x.tie < y.tie ? -1 : x.tie > y.tie ? 1 : 0,
      );
      const { owedCents } = remainingPrincipal({
        loggedPrincipal: principal ? { valueCents: principal.value_cents, effectiveDate: principal.effective_date } : null,
        originalPrincipalCents: a.original_principal_cents,
        originationDate: a.origination_date,
        openingBalanceCents: a.opening_balance_cents,
        fallbackDate: a.created_at.slice(0, 10),
        annualRateBps: latestRate.get(a.id)?.rate_bps ?? null,
        termMonths: a.term_months,
        asOfDate: today,
        payments: list.map(({ date, amountCents }) => ({ date, amountCents })),
      });
      balance = -owedCents;
    }
    out.set(a.id, balance);
  }
  return out;
}
