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

export const LAST_CATEGORY_FOR_PAYEE = `
  SELECT category_id FROM transactions
  WHERE payee_id = ? AND category_id IS NOT NULL
  ORDER BY date DESC, id DESC
  LIMIT 1
`;

