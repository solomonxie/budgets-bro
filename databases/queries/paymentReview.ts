// Ad hoc commitments: payees marked for the annual review, with their last
// outflow and 12-month total. Reads only tracked payees (partial index
// idx_payees_review) and their own transactions (idx_transactions_payee_date).
const OUTFLOW = 'AND t.amount_cents < 0 AND t.transfer_account_id IS NULL';

export const LIST_AD_HOC = `
  SELECT p.id AS payee_id, p.name, p.review_on, p.review_note,
    MAX(t.date) AS last_date,
    COALESCE(SUM(CASE WHEN t.date >= ? THEN -t.amount_cents ELSE 0 END), 0) AS year_cents,
    (SELECT -l.amount_cents FROM transactions l
      WHERE l.payee_id = p.id AND l.amount_cents < 0 AND l.transfer_account_id IS NULL
      ORDER BY l.date DESC, l.id DESC LIMIT 1) AS last_amount_cents
  FROM payees p
  LEFT JOIN transactions t ON t.payee_id = p.id ${OUTFLOW}
  WHERE p.board_id = ? AND p.review_on IS NOT NULL
  GROUP BY p.id
`;

export const LAST_OUTFLOW_FOR_PAYEE = `
  SELECT t.account_id, t.category_id, t.memo FROM transactions t
  WHERE t.payee_id = ? ${OUTFLOW}
  ORDER BY t.date DESC, t.id DESC LIMIT 1
`;

export const SET_SCHEDULE_REVIEW = 'UPDATE scheduled_transactions SET review_on = ?, review_note = ? WHERE id = ?';

export const SET_PAYEE_REVIEW = 'UPDATE payees SET review_on = ?, review_note = ? WHERE id = ?';

export const CONVERT_SCHEDULE = `
  UPDATE scheduled_transactions
  SET frequency = ?, interval_n = 1, days_of_week_mask = NULL, amount_cents = ?, next_date = ?, review_on = ?, review_note = NULL
  WHERE id = ?
`;
