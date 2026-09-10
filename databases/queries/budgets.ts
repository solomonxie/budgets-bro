export const ASSIGNED_THIS_MONTH = 'SELECT category_id, assigned_cents FROM budget_entries WHERE month = ?';

export const CUMULATIVE_ASSIGNED = `
  SELECT category_id, SUM(assigned_cents) as total FROM budget_entries WHERE month <= ? GROUP BY category_id
`;

export const CUMULATIVE_ACTIVITY = `
  SELECT category_id, SUM(amount_cents) as total FROM transactions
  WHERE category_id IS NOT NULL AND date < ? GROUP BY category_id
`;

export const ACTIVITY_THIS_MONTH = `
  SELECT category_id, SUM(amount_cents) as total FROM transactions
  WHERE category_id IS NOT NULL AND date >= ? AND date < ? GROUP BY category_id
`;

export const TOTAL_ASSIGNED_THROUGH_MONTH = 'SELECT SUM(assigned_cents) as total FROM budget_entries WHERE month <= ?';

// Signed sum of money available to budget through `throughMonth`: on-budget
// accounts' opening balances (dateless, always available) plus uncategorized,
// non-transfer transaction activity — includes negative balance-correction
// amounts on purpose.
export const TOTAL_UNCATEGORIZED_THROUGH_MONTH = `
  SELECT
    (SELECT COALESCE(SUM(opening_balance_cents), 0) FROM accounts WHERE on_budget = 1 AND archived_at IS NULL)
    +
    (SELECT COALESCE(SUM(t.amount_cents), 0) FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.category_id IS NULL AND t.transfer_account_id IS NULL AND a.on_budget = 1 AND t.date < ?)
    AS total
`;

export const UPSERT_ASSIGNED_CENTS = `
  INSERT INTO budget_entries (category_id, month, assigned_cents) VALUES (?, ?, ?)
  ON CONFLICT(category_id, month) DO UPDATE SET assigned_cents = excluded.assigned_cents
`;
