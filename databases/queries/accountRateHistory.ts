export const LIST_RATE_HISTORY = 'SELECT * FROM account_rate_history WHERE account_id = ? ORDER BY effective_date DESC, id DESC';

export const CURRENT_RATE = 'SELECT rate_bps FROM account_rate_history WHERE account_id = ? ORDER BY effective_date DESC, id DESC LIMIT 1';
