// Row shapes as returned by expo-sqlite (snake_case columns), before mapping
// into the camelCase domain types in src/domain/types.ts.

export interface BoardRow {
  id: number;
  name: string;
  created_at: string;
}

export interface AccountRow {
  id: number;
  board_id: number;
  name: string;
  type: string;
  on_budget: number;
  currency: string;
  opening_balance_cents: number;
  archived_at: string | null;
  created_at: string;
  interest_rate_bps: number | null;
  term_months: number | null;
  original_principal_cents: number | null;
  origination_date: string | null;
  original_house_price_cents: number | null;
}

export interface AccountRateHistoryRow {
  id: number;
  account_id: number;
  rate_bps: number;
  effective_date: string;
  created_at: string;
}

export interface AccountValueHistoryRow {
  id: number;
  account_id: number;
  value_cents: number;
  effective_date: string;
  created_at: string;
}

export interface CategoryGroupRow {
  id: number;
  board_id: number;
  name: string;
  sort_order: number;
  archived_at: string | null;
}

export interface CategoryRow {
  id: number;
  board_id: number;
  group_id: number;
  name: string;
  icon: string | null;
  sort_order: number;
  archived_at: string | null;
  linked_account_id: number | null;
}

export interface BudgetEntryRow {
  id: number;
  board_id: number;
  category_id: number;
  month: string;
  assigned_cents: number;
}

export interface PayeeRow {
  id: number;
  board_id: number;
  name: string;
  linked_account_id: number | null;
}

export interface TransactionRow {
  id: number;
  board_id: number;
  account_id: number;
  category_id: number | null;
  payee_id: number | null;
  memo: string | null;
  amount_cents: number;
  date: string;
  transfer_account_id: number | null;
  import_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionJoinRow extends TransactionRow {
  payee_name: string | null;
  category_name: string | null;
  category_icon: string | null;
}

export interface ScheduledTransactionRow {
  id: number;
  board_id: number;
  account_id: number;
  category_id: number | null;
  payee_id: number | null;
  memo: string | null;
  amount_cents: number;
  frequency: string;
  interval_n: number;
  next_date: string;
  end_date: string | null;
  auto_post: number;
  created_at: string;
}

export interface ScheduledTransactionJoinRow extends ScheduledTransactionRow {
  payee_name: string | null;
  category_name: string | null;
  category_icon: string | null;
  account_name: string;
}
