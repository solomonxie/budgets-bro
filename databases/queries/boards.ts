export const LIST_BOARDS = 'SELECT * FROM boards ORDER BY id';

export const DELETE_BOARD_CASCADE = [
  'DELETE FROM transactions WHERE board_id = ?',
  'DELETE FROM budget_entries WHERE board_id = ?',
  'DELETE FROM scheduled_transactions WHERE board_id = ?',
  'DELETE FROM custom_goals WHERE board_id = ?',
  'DELETE FROM categories WHERE board_id = ?',
  'DELETE FROM category_groups WHERE board_id = ?',
  'DELETE FROM payees WHERE board_id = ?',
  // These three key off account_id, not board_id — no REFERENCES clause
  // (see migration 006's note on FKs being app-enforced), so they'd
  // otherwise sit orphaned forever once the accounts row is gone below.
  'DELETE FROM account_rate_history WHERE account_id IN (SELECT id FROM accounts WHERE board_id = ?)',
  'DELETE FROM account_value_history WHERE account_id IN (SELECT id FROM accounts WHERE board_id = ?)',
  'DELETE FROM income_detail_history WHERE account_id IN (SELECT id FROM accounts WHERE board_id = ?)',
  'DELETE FROM accounts WHERE board_id = ?',
  'DELETE FROM boards WHERE id = ?',
];
