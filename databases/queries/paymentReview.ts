import { SELECT_WITH_LABELS } from './scheduledTransactions';

// QBR covers spending only: outflows from cash and credit card accounts.
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

// Candidates for detected recurring payments: the same payee charging the
// exact same amount more than once in the window. Cadence is inferred from
// the dates (domain/paymentReview.detectRecurring). With MAX(t.date), the
// bare t.category_id is the latest charge's (SQLite's min/max rule). Payees already
// scheduled are skipped; ignored ones are kept (listed
// under Ignored); a dismissed payee stays hidden until its review date (the
// next quarter), then comes back up.
export const LIST_REPEATED_CHARGES = `
  SELECT t.payee_id, p.name, -t.amount_cents AS amount_cents, GROUP_CONCAT(t.date) AS dates,
    MAX(t.date) AS last_date, t.category_id, p.review_on, p.review_mode
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  JOIN payees p ON p.id = t.payee_id
  WHERE t.board_id = ? AND t.date >= ? AND ${SPENDING('t')} AND ${SPENDING_ACCOUNT}
    AND p.linked_account_id IS NULL
    AND (p.review_mode IS NULL OR p.review_mode = 'ignored' OR (p.review_mode = 'dismissed' AND p.review_on <= ?))
    AND t.payee_id NOT IN (
      SELECT payee_id FROM scheduled_transactions WHERE board_id = ? AND payee_id IS NOT NULL AND amount_cents < 0
    )
  GROUP BY t.payee_id, t.amount_cents
  HAVING COUNT(*) >= 2
`;

export const SET_SCHEDULE_REVIEW = 'UPDATE scheduled_transactions SET review_on = ?, review_note = NULL, review_ignored = 0 WHERE id = ?';

export const SET_PAYEE_REVIEW_MODE = 'UPDATE payees SET review_mode = ?, review_on = ?, review_note = NULL WHERE id = ?';

export const SET_SCHEDULE_IGNORED = 'UPDATE scheduled_transactions SET review_ignored = ?, review_on = NULL, review_note = NULL WHERE id = ?';

// Open reminders first (soonest due), then history (newest first).
export const LIST_DECISIONS = `
  SELECT * FROM payment_decisions WHERE board_id = ?
  ORDER BY done_on IS NOT NULL, CASE WHEN done_on IS NULL THEN due_on END ASC, COALESCE(done_on, decided_on) DESC, id DESC
`;

export const INSERT_DECISION = `
  INSERT INTO payment_decisions
    (board_id, scheduled_transaction_id, payee_id, name, cadence, amount_cents, decision, note, decided_on, due_on, done_on)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const MARK_DECISION_DONE = 'UPDATE payment_decisions SET done_on = ? WHERE id = ?';

export const DELETE_DECISION = 'DELETE FROM payment_decisions WHERE id = ?';
