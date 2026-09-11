import type { AccountKind, AccountType } from './types';

const KIND_BY_TYPE: Record<AccountType, AccountKind> = {
  checking: 'Cash',
  cash: 'Cash',
  savings: 'Savings',
  income: 'Income',
  credit_card: 'Credit',
  loan: 'Loan',
  mortgage: 'Loan',
  tracking: 'Tracking',
};

export const ACCOUNT_KIND_ORDER: AccountKind[] = ['Cash', 'Savings', 'Income', 'Credit', 'Loan', 'Tracking'];

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

// Cash/savings/tracking accounts are assets; credit/loan balances are stored
// negative (debt) — Net Worth is the sum of everything either way, but
// Assets/Debts are broken out since lumping them into one number isn't
// meaningful on its own. A mortgage's `houseValueCents` (from
// accountHouseValueHistoryRepo's latest entry) is folded in as its
// offsetting asset, so a mortgage nets to home equity, not just the debt.
export function netWorth(accounts: { type: AccountType; balanceCents: number; houseValueCents?: number }[]): NetWorth {
  let assetsCents = 0;
  let debtsCents = 0;
  for (const { type, balanceCents, houseValueCents } of accounts) {
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
