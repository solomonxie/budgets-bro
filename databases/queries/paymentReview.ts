import { SELECT_WITH_LABELS } from './scheduledTransactions';

// ABR covers spending only: outflows from cash and credit card accounts.
// Transfers, loan/mortgage payments (account-linked payees, loan payment
// categories) and anything paid from savings or tracking accounts are out.
const SPENDING_ACCOUNT = "a.type IN ('cash', 'credit_card')";
const NOT_LOAN_CATEGORY = (col: string) =>
  `(${col} IS NULL OR ${col} NOT IN (SELECT loan_payment_category_id FROM accounts WHERE loan_payment_category_id IS NOT NULL))`;
const SPENDING = (t: string) =>
  `${t}.amount_cents < 0 AND ${t}.transfer_account_id IS NULL AND ${NOT_LOAN_CATEGORY(`${t}.category_id`)}`;

export const LIST_REVIEWABLE_SCHEDULES = `${SELECT_WITH_LABELS}
  WHERE s.board_id = ? AND s.amount_cents < 0 AND ${SPENDING_ACCOUNT}
    AND (p.id IS NULL OR p.linked_account_id IS NULL) AND ${NOT_LOAN_CATEGORY('s.category_id')}
  ORDER BY s.next_date ASC, s.id ASC`;

// Payees tracked by hand as ad hoc, with their last spending outflow and
// 12-month total.
export const LIST_AD_HOC = `
  SELECT p.id AS payee_id, p.name, p.review_on, p.review_note,
    MAX(t.date) AS last_date,
    COALESCE(SUM(CASE WHEN t.date >= ? THEN -t.amount_cents ELSE 0 END), 0) AS year_cents,
    (SELECT -l.amount_cents FROM transactions l JOIN accounts a ON a.id = l.account_id
      WHERE l.payee_id = p.id AND ${SPENDING('l')} AND ${SPENDING_ACCOUNT}
      ORDER BY l.date DESC, l.id DESC LIMIT 1) AS last_amount_cents
  FROM payees p
  LEFT JOIN (
    SELECT t.* FROM transactions t JOIN accounts a ON a.id = t.account_id
    WHERE ${SPENDING('t')} AND ${SPENDING_ACCOUNT}
  ) t ON t.payee_id = p.id
  WHERE p.board_id = ? AND p.review_on IS NOT NULL AND p.review_mode = 'adHoc'
  GROUP BY p.id
`;

// Candidates for detected recurring payments: the same payee charging the
// exact same amount more than once in the window. Cadence is inferred from
// the dates (domain/paymentReview.detectRecurring). Payees already
// scheduled or tracked as ad hoc are skipped; a dismissed payee only counts
// charges made after it was dismissed (review_on holds that date).
export const LIST_REPEATED_CHARGES = `
  SELECT t.payee_id, p.name, -t.amount_cents AS amount_cents, GROUP_CONCAT(t.date) AS dates,
    p.review_on, p.review_note, p.review_mode
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  JOIN payees p ON p.id = t.payee_id
  WHERE t.board_id = ? AND t.date >= ? AND ${SPENDING('t')} AND ${SPENDING_ACCOUNT}
    AND p.linked_account_id IS NULL
    AND (p.review_mode IS NULL OR (p.review_mode = 'dismissed' AND t.date > p.review_on))
    AND t.payee_id NOT IN (
      SELECT payee_id FROM scheduled_transactions WHERE board_id = ? AND payee_id IS NOT NULL AND amount_cents < 0
    )
  GROUP BY t.payee_id, t.amount_cents
  HAVING COUNT(*) >= 2
`;

export const LAST_OUTFLOW_FOR_PAYEE = `
  SELECT t.account_id, t.category_id, t.memo FROM transactions t JOIN accounts a ON a.id = t.account_id
  WHERE t.payee_id = ? AND ${SPENDING('t')} AND ${SPENDING_ACCOUNT}
  ORDER BY t.date DESC, t.id DESC LIMIT 1
`;

export const SET_SCHEDULE_REVIEW = 'UPDATE scheduled_transactions SET review_on = ?, review_note = ? WHERE id = ?';

export const SET_PAYEE_REVIEW_MODE = 'UPDATE payees SET review_mode = ?, review_on = ?, review_note = ? WHERE id = ?';

export const CONVERT_SCHEDULE = `
  UPDATE scheduled_transactions
  SET frequency = ?, interval_n = 1, days_of_week_mask = NULL, amount_cents = ?, next_date = ?, review_on = ?, review_note = NULL
  WHERE id = ?
`;
