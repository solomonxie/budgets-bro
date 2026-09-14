// An Income account is a tag on the real account's transactions, not a
// ledger of its own (see migration 021) — filter by income_account_id
// directly. Excludes scheduled/future transactions (date <= today), same
// guard as every other real-data query — see databases/queries/transactions.ts.
export const MONTHLY_INCOME_FOR_ACCOUNT = `
  SELECT substr(date, 1, 7) as month, SUM(amount_cents) as total
  FROM transactions
  WHERE income_account_id = ? AND date >= ? AND date < ? AND date <= ? AND board_id = ?
  GROUP BY month
`;

export const INCOME_TOTAL_FOR_ACCOUNT_IN_RANGE = `
  SELECT COALESCE(SUM(amount_cents), 0) as total
  FROM transactions
  WHERE income_account_id = ? AND date >= ? AND date < ? AND date <= ? AND board_id = ?
`;

// Powers the Accounts list's Income group — this year's total per income
// account, one query instead of N.
export const INCOME_THIS_YEAR_BY_ACCOUNT = `
  SELECT income_account_id, COALESCE(SUM(amount_cents), 0) as total
  FROM transactions
  WHERE income_account_id IS NOT NULL AND date >= ? AND date < ? AND date <= ? AND board_id = ?
  GROUP BY income_account_id
`;
