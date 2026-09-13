// A linked goal's progress is the account's live balance (opening +
// activity, same math as accountsRepo — a goal never needs a tracking/
// asset account's logged value, so no need to join accountValueHistory
// here), not a copy that could drift from the real account.
export const LIST_FOR_BOARD = `
  SELECT
    g.*,
    CASE WHEN g.linked_account_id IS NOT NULL
      THEN COALESCE((SELECT a.opening_balance_cents + COALESCE(SUM(t.amount_cents), 0)
                      FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id AND t.date <= ?
                      WHERE a.id = g.linked_account_id), 0)
      ELSE NULL
    END AS linked_balance_cents
  FROM custom_goals g
  WHERE g.board_id = ?
  ORDER BY g.sort_order ASC, g.id ASC
`;

export const INSERT_CUSTOM_GOAL = `
  INSERT INTO custom_goals (board_id, name, target_cents, linked_account_id, manual_progress_cents, sort_order)
  VALUES (?, ?, ?, ?, ?, ?)
`;

export const UPDATE_CUSTOM_GOAL = `
  UPDATE custom_goals
  SET name = ?, target_cents = ?, linked_account_id = ?, manual_progress_cents = ?
  WHERE id = ?
`;

export const DELETE_CUSTOM_GOAL = 'DELETE FROM custom_goals WHERE id = ?';

export const MAX_SORT_ORDER = 'SELECT MAX(sort_order) as max_order FROM custom_goals WHERE board_id = ?';
