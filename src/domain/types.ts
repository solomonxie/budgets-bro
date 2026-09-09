export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'tracking';

export type AccountKind = 'Cash' | 'Credit' | 'Loan' | 'Tracking';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  onBudget: boolean;
  currency: string;
  openingBalanceCents: number;
  archivedAt: string | null;
  createdAt: string;
}

export interface CategoryGroup {
  id: number;
  name: string;
  sortOrder: number;
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
