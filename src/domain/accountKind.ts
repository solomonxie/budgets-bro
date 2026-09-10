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
// Worth into Assets vs. Debts on the Accounts screen.
export const LIABILITY_KINDS: AccountKind[] = ['Credit', 'Loan'];

export function accountKind(type: AccountType): AccountKind {
  return KIND_BY_TYPE[type];
}

// Loan/mortgage accounts get an auto-generated budget category so payments
// toward them can be assigned money like any other category.
export function isLoanLikeType(type: AccountType): boolean {
  return type === 'loan' || type === 'mortgage';
}
