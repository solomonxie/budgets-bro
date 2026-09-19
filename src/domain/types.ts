import type { ScheduleFrequency } from './recurrence';

export interface Board {
  id: number;
  name: string;
  createdAt: string;
}

export type AccountType =
  | 'savings'
  | 'credit_card'
  | 'cash'
  | 'loan'
  | 'mortgage'
  | 'tracking'
  | 'asset'
  | 'giving';

export type AccountKind = 'Cash' | 'Savings' | 'Credit' | 'Loan' | 'Tracking' | 'Asset' | 'Giving';

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
  // Free-text, any account type — why this account exists, which branch it
  // is with, whatever the name alone doesn't say.
  note: string | null;
}

export interface AccountRateChange {
  id: number;
  accountId: number;
  rateBps: number;
  effectiveDate: string; // 'YYYY-MM-DD'
  // Why it changed — a promo ending, a fixed term rolling over — which the
  // percentage on its own can't say.
  note: string | null;
}

// Two kinds of reading share account_value_history (migration 024):
// 'value' is what a thing is worth (a home, a tracking account's total),
// 'principal' is what is still owed on a loan.
export type AccountValueKind = 'value' | 'principal';

export interface AccountValueChange {
  id: number;
  accountId: number;
  valueCents: number;
  effectiveDate: string; // 'YYYY-MM-DD'
  kind: AccountValueKind;
  // Where the number came from — "Zillow", "bank appraisal", "after the
  // kitchen" — since the value alone doesn't say why it moved.
  note: string | null;
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
  // Set only for the auto-created payee tied 1:1 to an account (named
  // after it) — selecting this payee on a transaction also posts a
  // mirrored credit to that account, same amount, opposite sign. This is
  // how inter-account transfers and loan/mortgage payments both work. See
  // payeesRepo.ensureAccountPayee / transactionsRepo.postLinkedAccountLeg.
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
  transferAccountId: number | null;
  importId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionWithLabels extends Transaction {
  payeeName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  accountName: string;
  accountType: AccountType;
}

export interface ScheduledTransaction {
  id: number;
  accountId: number;
  categoryId: number | null;
  payeeId: number | null;
  memo: string | null;
  amountCents: number; // signed
  frequency: ScheduleFrequency;
  intervalN: number;
  daysOfWeekMask: number | null; // only meaningful when frequency is 'weekly' — see domain/recurrence.ts
  nextDate: string; // 'YYYY-MM-DD'
  endDate: string | null;
  createdAt: string;
}

export interface ScheduledTransactionWithLabels extends ScheduledTransaction {
  payeeName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  accountName: string;
}

// A user-defined Baby Steps goal — progress comes from exactly one of
// `linkedAccountId` (the account's live balance) or `manualProgressCents`
// (typed in directly), never both.
export interface CustomGoal {
  id: number;
  name: string;
  targetCents: number;
  linkedAccountId: number | null;
  manualProgressCents: number | null;
  sortOrder: number;
}

export interface CustomGoalWithProgress extends CustomGoal {
  progressCents: number;
}
