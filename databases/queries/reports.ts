export const SPENDING_BY_CATEGORY = `
  SELECT c.id as category_id, c.name, c.icon, SUM(-t.amount_cents) as total
  FROM transactions t JOIN categories c ON c.id = t.category_id
  WHERE t.amount_cents < 0 AND t.date >= ? AND t.date < ? AND t.transfer_account_id IS NULL
  GROUP BY c.id ORDER BY total DESC
`;

// One row per (month, category) with nonzero spend — the caller pivots this
// into per-category series for the trend chart.
export const SPENDING_BY_CATEGORY_OVER_MONTHS = `
  SELECT c.id as category_id, c.name, c.icon, substr(t.date, 1, 7) as month, SUM(-t.amount_cents) as total
  FROM transactions t JOIN categories c ON c.id = t.category_id
  WHERE t.amount_cents < 0 AND t.date >= ? AND t.date < ? AND t.transfer_account_id IS NULL
  GROUP BY c.id, month
`;

export const INCOME_AND_SPENDING_IN_RANGE = `
  SELECT
    (SELECT COALESCE(SUM(t.amount_cents), 0) FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE t.amount_cents > 0 AND t.transfer_account_id IS NULL AND a.on_budget = 1 AND t.date >= ? AND t.date < ?) as income_cents,
    (SELECT COALESCE(SUM(-t.amount_cents), 0) FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE t.amount_cents < 0 AND t.transfer_account_id IS NULL AND a.on_budget = 1 AND t.date >= ? AND t.date < ?) as spending_cents
`;
