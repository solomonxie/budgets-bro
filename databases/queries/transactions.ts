export const SELECT_WITH_LABELS = `
  SELECT t.*, p.name as payee_name, c.name as category_name, c.icon as category_icon
  FROM transactions t
  LEFT JOIN payees p ON p.id = t.payee_id
  LEFT JOIN categories c ON c.id = t.category_id
`;

export const INSERT_TRANSACTION = `
  INSERT INTO transactions (board_id, account_id, category_id, payee_id, memo, amount_cents, date, is_interest, transfer_account_id, import_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const UPDATE_TRANSACTION = `
  UPDATE transactions
  SET account_id = ?, category_id = ?, payee_id = ?, memo = ?, amount_cents = ?, date = ?, is_interest = ?, updated_at = datetime('now')
  WHERE id = ?
`;

export const LAST_CATEGORY_FOR_PAYEE = `
  SELECT category_id FROM transactions
  WHERE payee_id = ? AND category_id IS NOT NULL
  ORDER BY date DESC, id DESC
  LIMIT 1
`;
