import type { AccountKind, AccountType } from './types';

const KIND_BY_TYPE: Record<AccountType, AccountKind> = {
  income: 'Income',
  cash: 'Cash',
  savings: 'Savings',
  credit_card: 'Credit',
  loan: 'Loan',
  mortgage: 'Loan',
  tracking: 'Tracking',
  asset: 'Asset',
};

export const ACCOUNT_KIND_ORDER: AccountKind[] = ['Cash', 'Savings', 'Tracking', 'Asset', 'Loan', 'Credit', 'Income'];

// Kinds whose balances are debts (stored as negative) — used to split Net
// Worth into Assets vs. Debts.
export const LIABILITY_KINDS: AccountKind[] = ['Credit', 'Loan'];

export function accountKind(type: AccountType): AccountKind {
  return KIND_BY_TYPE[type];
}

export interface NetWorth {
  assetsCents: number;
  debtsCents: number;
  netWorthCents: number;
}

// Cash/savings/tracking/asset accounts are assets; credit/loan balances are
// stored negative (debt) — Net Worth is the sum of everything either way, but
// Assets/Debts are broken out since lumping them into one number isn't
// meaningful on its own. A mortgage's `houseValueCents` (from
// accountValueHistoryRepo's latest entry) is folded in as its
// offsetting asset, so a mortgage nets to home equity, not just the debt.
export function netWorth(accounts: { type: AccountType; balanceCents: number; houseValueCents?: number }[]): NetWorth {
  let assetsCents = 0;
  let debtsCents = 0;
  for (const { type, balanceCents, houseValueCents } of accounts) {
    // Income accounts are a saved filter/tag over real accounts'
    // transactions, not a store of value (see migration 021) — never part
    // of Net Worth, regardless of whatever their own (frozen, pre-redesign)
    // ledger balance happens to be.
    if (accountKind(type) === 'Income') continue;
    if (LIABILITY_KINDS.includes(accountKind(type))) {
      debtsCents += -balanceCents;
      if (type === 'mortgage' && houseValueCents != null) assetsCents += houseValueCents;
    } else {
      assetsCents += balanceCents;
    }
  }
  return { assetsCents, debtsCents, netWorthCents: assetsCents - debtsCents };
}

// Loan/mortgage accounts get an auto-generated budget category so payments
// toward them can be assigned money like any other category.
export function isLoanLikeType(type: AccountType): boolean {
  return type === 'loan' || type === 'mortgage';
}

// Tracking (investments) and Asset (depreciating property: cars, watches,
// computers…) accounts both skip the normal ledger balance in favor of a
// manually-logged value history — see accountsRepo.resolveBalanceCents.
// The only difference between them is the chart mode (see
// ValueHistoryChart's `mode`): Tracking splits deposited-vs-gain, Asset is
// a single plain value line since there's no "deposits" concept.
export function usesLoggedValue(type: AccountType): boolean {
  return type === 'tracking' || type === 'asset';
}
