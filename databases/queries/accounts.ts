export const LIST_ACCOUNTS_WITH_BALANCES = `
  SELECT a.*, COALESCE(SUM(t.amount_cents), 0) as activity_cents
  FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id
  WHERE a.archived_at IS NULL
  GROUP BY a.id
  ORDER BY a.type, a.name
`;
