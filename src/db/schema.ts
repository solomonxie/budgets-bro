// Row shapes as returned by expo-sqlite (snake_case columns), before mapping
// into the camelCase domain types in src/domain/types.ts.

export interface AccountRow {
  id: number;
  name: string;
  type: string;
  on_budget: number;
  currency: string;
  opening_balance_cents: number;
  archived_at: string | null;
  created_at: string;
}

export interface CategoryGroupRow {
  id: number;
  name: string;
  sort_order: number;
}

export interface CategoryRow {
  id: number;
  group_id: number;
  name: string;
  sort_order: number;
  archived_at: string | null;
}

export interface BudgetEntryRow {
  id: number;
  category_id: number;
  month: string;
  assigned_cents: number;
}

export interface PayeeRow {
  id: number;
  name: string;
}

export interface TransactionRow {
  id: number;
  account_id: number;
  category_id: number | null;
  payee_id: number | null;
  memo: string | null;
  amount_cents: number;
  date: string;
  cleared: number;
  transfer_account_id: number | null;
  created_at: string;
  updated_at: string;
}
