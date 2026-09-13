// "Real" income only — the sweep-to-cash leg (see transactionsRepo's
// income auto-transfer) always sets transfer_account_id, so excluding it
// here is what keeps a swept paycheck from counting twice (once as the
// income entry, once as its own transfer leg landing back at ~$0 net).
// Excludes scheduled/future transactions (date <= today), same guard as
// every other real-data query — see databases/queries/transactions.ts.
export const MONTHLY_INCOME_FOR_ACCOUNT = `
  SELECT substr(date, 1, 7) as month, SUM(amount_cents) as total
  FROM transactions
  WHERE account_id = ? AND transfer_account_id IS NULL AND date >= ? AND date < ? AND date <= ? AND board_id = ?
  GROUP BY month
`;

export const INCOME_TOTAL_FOR_ACCOUNT_IN_RANGE = `
  SELECT COALESCE(SUM(amount_cents), 0) as total
  FROM transactions
  WHERE account_id = ? AND transfer_account_id IS NULL AND date >= ? AND date < ? AND date <= ? AND board_id = ?
`;
