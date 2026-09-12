export const ASSIGNED_THIS_MONTH = 'SELECT category_id, assigned_cents FROM budget_entries WHERE month = ? AND board_id = ?';

export const CUMULATIVE_ASSIGNED = `
  SELECT category_id, SUM(assigned_cents) as total FROM budget_entries WHERE month <= ? AND board_id = ? GROUP BY category_id
`;

// Every activity query below also excludes scheduled/future transactions
// (date <= today, on top of whatever month-range bound it already has) —
// a future-dated transaction inside the target month/range hasn't
// happened yet and shouldn't count as spent. See
// databases/queries/transactions.ts.
export const CUMULATIVE_ACTIVITY = `
  SELECT category_id, SUM(amount_cents) as total FROM transactions
  WHERE category_id IS NOT NULL AND date < ? AND date <= ? AND board_id = ? GROUP BY category_id
`;

export const ACTIVITY_THIS_MONTH = `
  SELECT category_id, SUM(amount_cents) as total FROM transactions
  WHERE category_id IS NOT NULL AND date >= ? AND date < ? AND date <= ? AND board_id = ? GROUP BY category_id
`;

// Ungrouped version of ACTIVITY_THIS_MONTH across a month range — one row
// per calendar month instead of per category, for a trailing-months
// average/median (see budgetsRepo.totalActivityByMonth).
export const TOTAL_ACTIVITY_BY_MONTH = `
  SELECT substr(date, 1, 7) as month, SUM(amount_cents) as total FROM transactions
  WHERE category_id IS NOT NULL AND date >= ? AND date < ? AND date <= ? AND board_id = ? GROUP BY month
`;

export const TOTAL_ASSIGNED_THROUGH_MONTH = 'SELECT SUM(assigned_cents) as total FROM budget_entries WHERE month <= ? AND board_id = ?';

// Ungrouped version of CUMULATIVE_ACTIVITY: total categorized activity
// across every category, used with TOTAL_ASSIGNED_THROUGH_MONTH to get one
// combined "Available" balance for all categories at once.
export const TOTAL_ACTIVITY_THROUGH_MONTH = `
  SELECT SUM(amount_cents) as total FROM transactions WHERE category_id IS NOT NULL AND date < ? AND date <= ? AND board_id = ?
`;

// Unassigned Cash = (money sitting in cash accounts) − (money already
// assigned to categories, spent or not). Restricted to actual cash
// (checking/cash/savings/income) accounts — credit cards, loans/mortgages,
// and tracking accounts don't hold assignable cash and would otherwise blow
// up this total with e.g. a mortgage's opening principal. A transfer into a
// cash account counts like any other transaction here (it's just another
// account's own outflow, so it nets out); the corresponding "money assigned"
// side already accounts for anything categorized, transfers included.
const CASH_ACCOUNT_TYPES = `('checking', 'cash', 'savings', 'income')`;

export const CASH_ACCOUNTS_BALANCE_THROUGH_MONTH = `
  SELECT
    (SELECT COALESCE(SUM(opening_balance_cents), 0) FROM accounts WHERE type IN ${CASH_ACCOUNT_TYPES} AND archived_at IS NULL AND board_id = ?)
    +
    (SELECT COALESCE(SUM(t.amount_cents), 0) FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.type IN ${CASH_ACCOUNT_TYPES} AND a.archived_at IS NULL AND a.board_id = ? AND t.date < ? AND t.date <= ?)
    AS total
`;

export const UPSERT_ASSIGNED_CENTS = `
  INSERT INTO budget_entries (category_id, month, assigned_cents, board_id) VALUES (?, ?, ?, ?)
  ON CONFLICT(category_id, month) DO UPDATE SET assigned_cents = excluded.assigned_cents
`;
