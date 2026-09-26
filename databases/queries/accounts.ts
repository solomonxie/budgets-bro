// Date filter lives in the JOIN's ON, not WHERE — a WHERE clause would drop
// the LEFT JOIN's whole point (accounts with zero qualifying transactions
// still need a row, contributing 0 via COALESCE, not get excluded outright).
// Excludes scheduled/future transactions (date > today) from the balance,
// same as everywhere else — see databases/queries/transactions.ts.
export const LIST_ACCOUNTS_WITH_BALANCES = `
  SELECT a.*, COALESCE(SUM(t.amount_cents), 0) as activity_cents
  FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id AND t.date <= ?
  WHERE a.archived_at IS NULL AND a.board_id = ?
  GROUP BY a.id
  ORDER BY a.sort_order, a.name
`;

export const LIST_CLOSED_ACCOUNTS_WITH_BALANCES = `
  SELECT a.*, COALESCE(SUM(t.amount_cents), 0) as activity_cents
  FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id AND t.date <= ?
  WHERE a.archived_at IS NOT NULL AND a.board_id = ?
  GROUP BY a.id
  ORDER BY a.archived_at DESC
`;

// Every posted transaction on the board's loan/mortgage accounts, so each
// loan's remaining principal can be derived in one pass instead of a query
// per account (see accountsRepo.listAccountsWithBalances). Same "no future
// dates" rule as the balance queries above.
export const LOAN_PAYMENTS_FOR_BOARD = `
  SELECT t.account_id, t.amount_cents, t.date
  FROM transactions t JOIN accounts a ON a.id = t.account_id
  WHERE a.board_id = ? AND a.type IN ('loan', 'mortgage') AND t.date <= ?
  ORDER BY t.date
`;

// What has gone into an account since the last time its value was written
// down — a tracking account's balance is its latest logged value plus the
// contributions made after it, since a deposit is real money in whether or
// not anyone has re-valued the account since. With no reading on file this
// sums the whole ledger (every date is later than '').
export const ACTIVITY_SINCE_LATEST_VALUE = `
  SELECT t.account_id, COALESCE(SUM(t.amount_cents), 0) as total
  FROM transactions t JOIN accounts a ON a.id = t.account_id
  WHERE a.board_id = ? AND t.date <= ?
    AND t.date > COALESCE((
      SELECT MAX(h.effective_date) FROM account_value_history h
      WHERE h.account_id = t.account_id AND h.kind = 'value' AND h.effective_date <= ?
    ), '')
  GROUP BY t.account_id
`;

// Monthly net movement per account, for rebuilding what each was worth in a
// past month (domain/netWorthTrend). Aggregated in SQL so the trend doesn't
// have to carry every transaction across the bridge.
export const MONTHLY_ACTIVITY_BY_ACCOUNT = `
  SELECT t.account_id, substr(t.date, 1, 7) as month, COALESCE(SUM(t.amount_cents), 0) as total
  FROM transactions t JOIN accounts a ON a.id = t.account_id
  WHERE a.board_id = ? AND t.date <= ?
  GROUP BY t.account_id, month
  ORDER BY month
`;

// The earliest month the board has any history in — where the trend starts.
export const EARLIEST_ACTIVITY_MONTH = `
  SELECT MIN(month) as month FROM (
    SELECT MIN(substr(t.date, 1, 7)) as month FROM transactions t
      JOIN accounts a ON a.id = t.account_id WHERE a.board_id = ?
    UNION ALL
    SELECT MIN(substr(h.effective_date, 1, 7)) as month FROM account_value_history h
      JOIN accounts a ON a.id = h.account_id WHERE a.board_id = ?
  )
`;
