export const LIST_HOUSE_VALUE_HISTORY =
  'SELECT * FROM account_house_value_history WHERE account_id = ? ORDER BY effective_date DESC, id DESC';

export const CURRENT_HOUSE_VALUE =
  'SELECT value_cents FROM account_house_value_history WHERE account_id = ? ORDER BY effective_date DESC, id DESC LIMIT 1';

// Latest value_cents per mortgage account on a board, for the Net Worth
// rollup — one row per account_id via the correlated-subquery "latest row"
// idiom (mirrors effective_date DESC, id DESC ordering above).
export const CURRENT_HOUSE_VALUES_FOR_BOARD = `
  SELECT h.account_id, h.value_cents
  FROM account_house_value_history h
  JOIN accounts a ON a.id = h.account_id
  WHERE a.board_id = ?
    AND h.id = (
      SELECT h2.id FROM account_house_value_history h2
      WHERE h2.account_id = h.account_id
      ORDER BY h2.effective_date DESC, h2.id DESC
      LIMIT 1
    )
`;
