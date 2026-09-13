export const LIST_INCOME_DETAIL_HISTORY = `
  SELECT * FROM income_detail_history WHERE account_id = ? ORDER BY effective_date DESC, id DESC
`;
