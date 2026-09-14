export const SELECT_WITH_LABELS = `
  SELECT t.*, p.name as payee_name, c.name as category_name, c.icon as category_icon, a.name as account_name
  FROM transactions t
  LEFT JOIN payees p ON p.id = t.payee_id
  LEFT JOIN categories c ON c.id = t.category_id
  JOIN accounts a ON a.id = t.account_id
`;

export const INSERT_TRANSACTION = `
  INSERT INTO transactions (board_id, account_id, category_id, payee_id, memo, amount_cents, date, transfer_account_id, import_id, income_account_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const UPDATE_TRANSACTION = `
  UPDATE transactions
  SET account_id = ?, category_id = ?, payee_id = ?, memo = ?, amount_cents = ?, date = ?, income_account_id = ?, updated_at = datetime('now')
  WHERE id = ?
`;

// Scheduled/future transactions (date > today) are excluded from every
// "real" list/balance/activity query in the app and shown only in the
// account page's own Scheduled section — see transactionsRepo.ts's
// listFutureTransactionsForAccount and databases/queries/accounts.ts,
// budgets.ts, reports.ts (each repeats this same `date <= ?` guard).
export const LAST_CATEGORY_FOR_PAYEE = `
  SELECT category_id FROM transactions
  WHERE payee_id = ? AND category_id IS NOT NULL
  ORDER BY date DESC, id DESC
  LIMIT 1
`;

// Powers an Income account's own detail page — a saved filter over
// whichever real accounts the money actually landed in, not a ledger of
// its own (see migration 021). Same date/board guards as every other list.
export const SELECT_FOR_INCOME_ACCOUNT = `${SELECT_WITH_LABELS} WHERE t.income_account_id = ? AND t.board_id = ? AND t.date <= ? ORDER BY t.date DESC, t.id DESC`;
