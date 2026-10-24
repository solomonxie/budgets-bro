export const SELECT_WITH_LABELS = `
  SELECT t.*, p.name as payee_name, c.name as category_name, c.icon as category_icon, a.name as account_name, a.type as account_type
  FROM transactions t
  LEFT JOIN payees p ON p.id = t.payee_id
  LEFT JOIN categories c ON c.id = t.category_id
  JOIN accounts a ON a.id = t.account_id
`;

export const INSERT_TRANSACTION = `
  INSERT INTO transactions (board_id, account_id, category_id, payee_id, memo, amount_cents, date, transfer_account_id, import_id, purchase_items)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const UPDATE_TRANSACTION = `
  UPDATE transactions
  SET account_id = ?, category_id = ?, payee_id = ?, memo = ?, amount_cents = ?, date = ?, purchase_items = ?, updated_at = datetime('now')
  WHERE id = ?
`;

// Scheduled/future transactions (date > today) are excluded from every
// "real" list/balance/activity query in the app and shown only in the
// account page's own Scheduled section — see transactionsRepo.ts's
// listFutureTransactionsForAccount and databases/queries/accounts.ts,
// budgets.ts, reports.ts (each repeats this same `date <= ?` guard).
// Purchase items only: three columns and no joins, because neither the
// spend form's name suggestions nor the Purchase Insights page needs a
// payee/category/account label — and SELECT_WITH_LABELS costs three joins
// over the whole board to provide them.
export const SELECT_PURCHASE_ITEMS = `
  SELECT id, date, purchase_items
  FROM transactions
  WHERE board_id = ? AND purchase_items IS NOT NULL AND purchase_items <> '' AND date <= ?
  ORDER BY date DESC, id DESC
`;

// Hand-entered only: an import would otherwise decide the default.
// The cash account most spending is typed against — recent first, then
// all-time — so one stray entry elsewhere doesn't move the default.
export const MAIN_SPENDING_ACCOUNT = `
  SELECT a.id AS account_id FROM accounts a
  LEFT JOIN transactions t ON t.account_id = a.id
    AND t.import_id IS NULL AND t.transfer_account_id IS NULL
    AND t.amount_cents < 0
  WHERE a.board_id = ? AND a.type = 'cash' AND a.archived_at IS NULL
  GROUP BY a.id
  ORDER BY SUM(t.date >= ?) DESC, COUNT(t.id) DESC, a.id
  LIMIT 1
`;

export const LAST_CATEGORY_FOR_PAYEE = `
  SELECT category_id FROM transactions
  WHERE payee_id = ? AND category_id IS NOT NULL
  ORDER BY date DESC, id DESC
  LIMIT 1
`;


// A loan's payments by month: the legs posted into it from another account,
// grouped in SQL so only one row per month comes back. Rides
// idx_transactions_account.
export const LOAN_PAYMENTS_BY_MONTH = `
  SELECT substr(date, 1, 7) AS month, SUM(amount_cents) AS cents
  FROM transactions
  WHERE account_id = ? AND amount_cents > 0 AND transfer_account_id IS NOT NULL
    AND is_interest = 0 AND date >= ? AND date <= ?
  GROUP BY month
  ORDER BY month DESC
`;

// Which account usually pays a loan — the one behind most of its payments.
export const LOAN_PAYING_ACCOUNT = `
  SELECT transfer_account_id AS account_id
  FROM transactions
  WHERE account_id = ? AND amount_cents > 0 AND transfer_account_id IS NOT NULL
  GROUP BY transfer_account_id
  ORDER BY COUNT(*) DESC
  LIMIT 1
`;
