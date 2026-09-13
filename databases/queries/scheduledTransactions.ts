// Same join shape as databases/queries/transactions.ts's SELECT_WITH_LABELS,
// plus the account's own name (a schedule can span any account, unlike a
// transaction list already scoped to one).
export const SELECT_WITH_LABELS = `
  SELECT s.*, p.name as payee_name, c.name as category_name, c.icon as category_icon, a.name as account_name
  FROM scheduled_transactions s
  LEFT JOIN payees p ON p.id = s.payee_id
  LEFT JOIN categories c ON c.id = s.category_id
  JOIN accounts a ON a.id = s.account_id
`;

export const LIST_FOR_BOARD = `${SELECT_WITH_LABELS} WHERE s.board_id = ? ORDER BY s.next_date ASC, s.id ASC`;

// Due auto-post schedules — `next_date <= ?` (today), checked lazily on
// app foreground (see useAutoPostScheduledTransactions).
export const LIST_DUE_AUTO_POST = `
  ${SELECT_WITH_LABELS}
  WHERE s.board_id = ? AND s.auto_post = 1 AND s.next_date <= ?
  ORDER BY s.next_date ASC, s.id ASC
`;

export const INSERT_SCHEDULED_TRANSACTION = `
  INSERT INTO scheduled_transactions (board_id, account_id, category_id, payee_id, memo, amount_cents, frequency, interval_n, next_date, end_date, auto_post)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const UPDATE_SCHEDULED_TRANSACTION = `
  UPDATE scheduled_transactions
  SET account_id = ?, category_id = ?, payee_id = ?, memo = ?, amount_cents = ?, frequency = ?, interval_n = ?, next_date = ?, end_date = ?, auto_post = ?
  WHERE id = ?
`;

export const UPDATE_NEXT_DATE = 'UPDATE scheduled_transactions SET next_date = ? WHERE id = ?';

export const DELETE_SCHEDULED_TRANSACTION = 'DELETE FROM scheduled_transactions WHERE id = ?';
