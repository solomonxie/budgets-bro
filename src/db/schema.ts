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
  note: string | null;
  tracking_kind: string | null;
}

export interface AccountRateHistoryRow {
  id: number;
  account_id: number;
  rate_bps: number;
  effective_date: string;
  note: string | null;
  created_at: string;
}

export interface AccountValueHistoryRow {
  id: number;
  account_id: number;
  value_cents: number;
  effective_date: string;
  kind: string;
  note: string | null;
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
  purchase_items: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionJoinRow extends TransactionRow {
  payee_name: string | null;
  category_name: string | null;
  category_icon: string | null;
  account_name: string;
  account_type: string;
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
  created_at: string;
  days_of_week_mask: number | null;
}

export interface ScheduledTransactionJoinRow extends ScheduledTransactionRow {
  payee_name: string | null;
  category_name: string | null;
  category_icon: string | null;
  account_name: string;
}

export interface CustomGoalRow {
  id: number;
  board_id: number;
  name: string;
  target_cents: number;
  linked_account_id: number | null;
  manual_progress_cents: number | null;
  sort_order: number;
  created_at: string;
}

export interface CustomGoalJoinRow extends CustomGoalRow {
  linked_balance_cents: number | null;
}

export interface HouseRow {
  id: number;
  board_id: number;
  name: string;
  address: string | null;
  city: string | null;
  community: string | null;
  listing_url: string | null;
  status: string;
  rating: number | null;
  viewed_on: string | null;
  asking_price_cents: number | null;
  assessed_value_cents: number | null;
  strata_fee_cents: number | null;
  property_tax_annual_cents: number | null;
  property_type: string | null;
  beds: number | null;
  baths: number | null;
  floor_area_sqft: number | null;
  lot_sqft: number | null;
  levels: number | null;
  year_built: number | null;
  parking: string | null;
  orientation: string | null;
  roof_age_years: number | null;
  furnace_age_years: number | null;
  water_tank_age_years: number | null;
  windows: string | null;
  renovations: string | null;
  issues: string | null;
  school_catchment: string | null;
  commute_minutes: number | null;
  transit: string | null;
  noise: string | null;
  neighbourhood: string | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityPriceRow {
  id: number;
  board_id: number;
  city: string;
  community: string;
  property_type: string | null;
  as_of_month: string;
  benchmark_price_cents: number;
  note: string | null;
  created_at: string;
}
