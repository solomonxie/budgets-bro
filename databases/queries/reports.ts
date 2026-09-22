// Both spending-by-category queries below join accounts (AND a.on_budget =
// 1) for the same reason budgets.ts's activity queries do: a category is
// money assigned out of an on-budget account, so a transaction on a
// tracking account contributes nothing here regardless of whether it
// happens to have a category set. Also excludes scheduled/future
// transactions (date <= today) — see databases/queries/transactions.ts.
export const SPENDING_BY_CATEGORY = `
  SELECT c.id as category_id, c.name, c.icon, SUM(-t.amount_cents) as total
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
  WHERE t.amount_cents < 0 AND t.date >= ? AND t.date < ? AND t.date <= ? AND t.transfer_account_id IS NULL AND t.board_id = ?
  GROUP BY c.id ORDER BY total DESC
`;

// One row per (month, category) with nonzero spend — the caller pivots this
// into per-category series for the trend chart.
export const SPENDING_BY_CATEGORY_OVER_MONTHS = `
  SELECT c.id as category_id, c.name, c.icon, substr(t.date, 1, 7) as month, SUM(-t.amount_cents) as total
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
  WHERE t.amount_cents < 0 AND t.date >= ? AND t.date < ? AND t.date <= ? AND t.transfer_account_id IS NULL AND t.board_id = ?
  GROUP BY c.id, month
`;

export const EARLIEST_TRANSACTION_MONTH = `
  SELECT MIN(substr(date, 1, 7)) as month FROM transactions WHERE board_id = ?
`;

// Excludes scheduled/future transactions (date <= today) — a future-dated
// paycheck/bill inside the requested range hasn't happened yet and
// shouldn't inflate a year-to-date total (this feeds Tax Insights).
export const INCOME_AND_SPENDING_IN_RANGE = `
  SELECT
    (SELECT COALESCE(SUM(t.amount_cents), 0) FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE t.amount_cents > 0 AND t.transfer_account_id IS NULL AND a.on_budget = 1 AND t.board_id = ? AND t.date >= ? AND t.date < ? AND t.date <= ?) as income_cents,
    (SELECT COALESCE(SUM(-t.amount_cents), 0) FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE t.amount_cents < 0 AND t.transfer_account_id IS NULL AND a.on_budget = 1 AND t.board_id = ? AND t.date >= ? AND t.date < ? AND t.date <= ?) as spending_cents
`;

// Where the year's inflow came from, by payee — the replacement for the old
// per-income-account breakdown (migration 028). Same definition of income as
// INCOME_AND_SPENDING_IN_RANGE above (positive, not a transfer, on-budget), so
// the parts add up to the total. Rows with no payee come back as one
// unnamed bucket the caller labels.
export const INCOME_BY_PAYEE_IN_RANGE = `
  SELECT t.payee_id, p.name as payee_name, COALESCE(SUM(t.amount_cents), 0) as total
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN payees p ON p.id = t.payee_id
  WHERE t.amount_cents > 0 AND t.transfer_account_id IS NULL AND a.on_budget = 1
    AND t.board_id = ? AND t.date >= ? AND t.date < ? AND t.date <= ?
  GROUP BY t.payee_id
  ORDER BY total DESC
`;

// Who the money went to, month by month — the payee equivalent of
// SPENDING_BY_CATEGORY_OVER_MONTHS, and the same definition of spending
// (negative, not a transfer, on-budget, already happened) so the two pages
// can be read against each other. Rows with no payee come back as one
// unnamed bucket; the caller reports it separately rather than ranking it,
// since a blank is not somebody you pay.
export const SPENDING_BY_PAYEE_OVER_MONTHS = `
  SELECT t.payee_id, p.name as payee_name, substr(t.date, 1, 7) as month,
         SUM(-t.amount_cents) as total, COUNT(t.id) as count
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
  LEFT JOIN payees p ON p.id = t.payee_id
  WHERE t.amount_cents < 0 AND t.date >= ? AND t.date < ? AND t.date <= ? AND t.transfer_account_id IS NULL AND t.board_id = ?
  GROUP BY t.payee_id, month
`;
