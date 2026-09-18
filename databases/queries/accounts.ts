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
  ORDER BY a.type, a.name
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
