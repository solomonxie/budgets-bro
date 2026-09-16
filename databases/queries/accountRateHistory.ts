export const LIST_RATE_HISTORY = 'SELECT * FROM account_rate_history WHERE account_id = ? ORDER BY effective_date DESC, id DESC';

export const CURRENT_RATE = 'SELECT rate_bps FROM account_rate_history WHERE account_id = ? ORDER BY effective_date DESC, id DESC LIMIT 1';

// One row per account for a whole board — the finance-tools hubs show the
// current rate next to every loan, and a per-account query each would be one
// round trip per row (same "latest row" idiom as CURRENT_VALUES_FOR_BOARD).
export const CURRENT_RATES_FOR_BOARD = `
  SELECT h.account_id, h.rate_bps
  FROM account_rate_history h
  JOIN accounts a ON a.id = h.account_id
  WHERE a.board_id = ?
    AND h.id = (
      SELECT h2.id FROM account_rate_history h2
      WHERE h2.account_id = h.account_id
      ORDER BY h2.effective_date DESC, h2.id DESC
      LIMIT 1
    )
`;
