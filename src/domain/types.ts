export interface Board {
  id: number;
  name: string;
  createdAt: string;
}

export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'cash'
  | 'loan'
  | 'mortgage'
  | 'income'
  | 'tracking';

export type AccountKind = 'Cash' | 'Savings' | 'Income' | 'Credit' | 'Loan' | 'Tracking';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  onBudget: boolean;
  currency: string;
  openingBalanceCents: number;
  archivedAt: string | null;
  createdAt: string;
  // Loan/mortgage terms — null unless set on a loan-like account.
  // interestRateBps is legacy — current rate now comes from the latest
  // accountRateHistoryRepo entry; this column is no longer written to.
  interestRateBps: number | null;
  termMonths: number | null;
  originalPrincipalCents: number | null;
  originationDate: string | null;
  originalHousePriceCents: number | null;
}

export interface AccountRateChange {
  id: number;
  accountId: number;
  rateBps: number;
  effectiveDate: string; // 'YYYY-MM-DD'
}

export interface CategoryGroup {
  id: number;
  name: string;
  sortOrder: number;
  archivedAt: string | null;
}

export interface Category {
  id: number;
  groupId: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  archivedAt: string | null;
}

export interface BudgetEntry {
  id: number;
  categoryId: number;
  month: string; // 'YYYY-MM'
  assignedCents: number;
}

export interface Payee {
  id: number;
  name: string;
  // Set only for the auto-created payee tied to a loan/mortgage account
  // (named after it) — selecting this payee on a transaction also posts a
  // mirrored credit to that account, same amount, opposite sign. See
  // payeesRepo.ensurePaymentPayee / transactionsRepo.postLinkedAccountLeg.
  linkedAccountId: number | null;
}

export interface Transaction {
  id: number;
  accountId: number;
  categoryId: number | null;
  payeeId: number | null;
  memo: string | null;
  amountCents: number;
  date: string; // 'YYYY-MM-DD'
  cleared: boolean;
  isInterest: boolean;
  transferAccountId: number | null;
  importId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionWithLabels extends Transaction {
  payeeName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
}
