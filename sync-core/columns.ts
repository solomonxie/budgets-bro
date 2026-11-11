// Every synced column per entity: PROTOCOL.md "Entities (v1)" (FK, text and
// LWW fields together). Never `id`, `gid` or `updated_at`. A column added to
// a table later stays on the device until it is listed here, in a new
// protocol version.
export const syncedColumns: Readonly<Record<string, readonly string[]>> = {
  boards: ['name', 'created_at'],
  accounts: [
    'board_id', 'name', 'type', 'on_budget', 'currency', 'opening_balance_cents', 'archived_at',
    'created_at', 'interest_rate_bps', 'term_months', 'original_principal_cents', 'origination_date',
    'original_house_price_cents', 'note', 'tracking_kind', 'loan_payment_category_id', 'sort_order',
  ],
  category_groups: ['board_id', 'name', 'sort_order', 'archived_at'],
  categories: ['board_id', 'group_id', 'name', 'icon', 'sort_order', 'archived_at', 'linked_account_id'],
  budget_entries: ['board_id', 'category_id', 'month', 'assigned_cents'],
  payees: ['board_id', 'name', 'linked_account_id', 'review_on', 'review_note', 'review_mode'],
  transactions: [
    'board_id', 'account_id', 'category_id', 'payee_id', 'memo', 'amount_cents', 'date',
    'transfer_account_id', 'import_id', 'created_at', 'purchase_items',
  ],
  scheduled_transactions: [
    'board_id', 'account_id', 'category_id', 'payee_id', 'memo', 'amount_cents', 'frequency',
    'interval_n', 'next_date', 'end_date', 'created_at', 'days_of_week_mask', 'review_on',
    'review_note', 'review_ignored',
  ],
  custom_goals: [
    'board_id', 'name', 'target_cents', 'linked_account_id', 'manual_progress_cents', 'sort_order',
    'created_at',
  ],
  payment_decisions: [
    'board_id', 'scheduled_transaction_id', 'payee_id', 'name', 'cadence', 'amount_cents',
    'decision', 'note', 'decided_on', 'due_on', 'done_on',
  ],
  account_value_history: ['account_id', 'value_cents', 'effective_date', 'created_at', 'note', 'kind'],
  account_rate_history: ['account_id', 'rate_bps', 'effective_date', 'created_at', 'note'],
  houses: [
    'board_id', 'name', 'address', 'city', 'community', 'listing_url', 'status', 'rating',
    'viewed_on', 'asking_price_cents', 'assessed_value_cents', 'strata_fee_cents',
    'property_tax_annual_cents', 'property_type', 'beds', 'baths', 'floor_area_sqft', 'lot_sqft',
    'levels', 'year_built', 'parking', 'orientation', 'roof_age_years', 'furnace_age_years',
    'water_tank_age_years', 'windows', 'renovations', 'issues', 'school_catchment',
    'commute_minutes', 'transit', 'noise', 'neighbourhood', 'pros', 'cons', 'notes', 'created_at',
    'listed_on', 'offer_price_cents', 'deposit_cents', 'subject_removal_date', 'completion_date',
    'checklist', 'maintenance_monthly_cents', 'bus_distance_m', 'train_distance_m',
    'school_distance_m', 'grocery_distance_m',
  ],
  community_prices: [
    'board_id', 'city', 'community', 'property_type', 'as_of_month', 'benchmark_price_cents',
    'note', 'created_at',
  ],
  house_prices: ['house_id', 'date', 'price_cents'],
};
