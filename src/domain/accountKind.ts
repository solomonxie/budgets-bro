import type { AccountKind, AccountType } from './types';

const KIND_BY_TYPE: Record<AccountType, AccountKind> = {
  checking: 'Cash',
  savings: 'Cash',
  cash: 'Cash',
  credit_card: 'Credit',
  loan: 'Loan',
  tracking: 'Tracking',
};

export const ACCOUNT_KIND_ORDER: AccountKind[] = ['Cash', 'Credit', 'Loan', 'Tracking'];

export function accountKind(type: AccountType): AccountKind {
  return KIND_BY_TYPE[type];
}
