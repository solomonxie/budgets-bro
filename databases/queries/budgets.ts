export const ASSIGNED_THIS_MONTH = 'SELECT category_id, assigned_cents FROM budget_entries WHERE month = ? AND board_id = ?';

export const CUMULATIVE_ASSIGNED = `
  SELECT category_id, SUM(assigned_cents) as total FROM budget_entries WHERE month <= ? AND board_id = ? GROUP BY category_id
`;

// Every activity query below also:
// - excludes scheduled/future transactions (date <= today, on top of
//   whatever month-range bound it already has) — a future-dated
//   transaction inside the target month/range hasn't happened yet and
//   shouldn't count as spent. See databases/queries/transactions.ts.
// - only counts on-budget accounts (JOIN ... AND a.on_budget = 1) — a
//   category is money assigned out of an on-budget account's cash; a
//   tracking account (net-worth-only, outside the envelope system) was
//   never assigned anything, so a category on one of its transactions
//   (if the UI ever let one through) must not count as spent. Matches
//   reports.ts's INCOME_AND_SPENDING_IN_RANGE, which already did this.
export const CUMULATIVE_ACTIVITY = `
  SELECT t.category_id, SUM(t.amount_cents) as total FROM transactions t
  JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
  WHERE t.category_id IS NOT NULL AND t.date < ? AND t.date <= ? AND t.board_id = ? GROUP BY t.category_id
`;

export const ACTIVITY_THIS_MONTH = `
  SELECT t.category_id, SUM(t.amount_cents) as total FROM transactions t
  JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
  WHERE t.category_id IS NOT NULL AND t.date >= ? AND t.date < ? AND t.date <= ? AND t.board_id = ? GROUP BY t.category_id
`;

// Ungrouped version of ACTIVITY_THIS_MONTH across a month range — one row
// per calendar month instead of per category, for a trailing-months
// average/median (see budgetsRepo.totalActivityByMonth).
export const TOTAL_ACTIVITY_BY_MONTH = `
  SELECT substr(t.date, 1, 7) as month, SUM(t.amount_cents) as total FROM transactions t
  JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
  WHERE t.category_id IS NOT NULL AND t.date >= ? AND t.date < ? AND t.date <= ? AND t.board_id = ? GROUP BY month
`;

// Per category *per month*, rather than one cumulative total each — what a
// running balance has to be walked through to find the month a category
// first went negative. A balance is a running sum (see
// domain/budgetMath.categoryBalanceCents), so covering an overspend means
// assigning in the month that broke, not in whichever month you happen to
// be looking at.
export const MONTHLY_ASSIGNED_BY_CATEGORY = `
  SELECT category_id, month, SUM(assigned_cents) as total FROM budget_entries
  WHERE month <= ? AND board_id = ? GROUP BY category_id, month
`;

export const MONTHLY_ACTIVITY_BY_CATEGORY = `
  SELECT t.category_id, substr(t.date, 1, 7) as month, SUM(t.amount_cents) as total FROM transactions t
  JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
  WHERE t.category_id IS NOT NULL AND t.date < ? AND t.date <= ? AND t.board_id = ?
  GROUP BY t.category_id, month
`;

export const TOTAL_ASSIGNED_THROUGH_MONTH = 'SELECT SUM(assigned_cents) as total FROM budget_entries WHERE month <= ? AND board_id = ?';

// Every month's assignments, months ahead of today included. Money given to
// next month is spoken for now — there is one pile of cash, and asking "was
// it assigned yet?" as of a month you are merely browsing describes the same
// dollars twice (see budgetsRepo.unassignedBreakdown).
export const TOTAL_ASSIGNED_ALL_MONTHS =
  'SELECT SUM(assigned_cents) as total FROM budget_entries WHERE board_id = ?';

// The slice of the above that belongs to months still ahead. Shown in the
// breakdown because it is the usual answer to "why is Unassigned negative?"
// — money promised to a later month is gone from today's pile, and nothing
// else on the Budget screen says where it went.
export const TOTAL_ASSIGNED_AFTER_MONTH =
  'SELECT SUM(assigned_cents) as total FROM budget_entries WHERE month > ? AND board_id = ?';

// Ungrouped version of CUMULATIVE_ACTIVITY: total categorized activity
// across every category, used with TOTAL_ASSIGNED_THROUGH_MONTH to get one
// combined "Available" balance for all categories at once.
export const TOTAL_ACTIVITY_THROUGH_MONTH = `
  SELECT SUM(t.amount_cents) as total FROM transactions t
  JOIN accounts a ON a.id = t.account_id AND a.on_budget = 1
  WHERE t.category_id IS NOT NULL AND t.date < ? AND t.date <= ? AND t.board_id = ?
`;

// Unassigned Cash = (money sitting in cash accounts) − (money already
// assigned to categories, spent or not). Restricted to actual cash
// (cash/savings) accounts — credit cards, loans/mortgages, and
// tracking/asset accounts don't hold assignable cash and would otherwise
// blow up this total with e.g. a mortgage's opening principal. A transfer
// into a cash account counts like any other transaction here (it's just
// another account's own outflow, so it nets out); the corresponding "money
// assigned" side already accounts for anything categorized, transfers
// included.
const CASH_ACCOUNT_TYPES = `('cash', 'savings')`;

export const CASH_ACCOUNTS_BALANCE_THROUGH_MONTH = `
  SELECT
    (SELECT COALESCE(SUM(opening_balance_cents), 0) FROM accounts WHERE type IN ${CASH_ACCOUNT_TYPES} AND archived_at IS NULL AND board_id = ?)
    +
    (SELECT COALESCE(SUM(t.amount_cents), 0) FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.type IN ${CASH_ACCOUNT_TYPES} AND a.archived_at IS NULL AND a.board_id = ? AND t.date < ? AND t.date <= ?)
    AS total
`;

// What is owed on credit cards right now. Not part of any balance the
// budget computes — it is shown beside Unassigned Cash to explain it (see
// budgetsRepo.unassignedBreakdown): categorised spending on a card empties
// an envelope without taking anything out of cash, so until the card is
// paid off that much of "unassigned" is already committed.
export const CREDIT_CARD_BALANCE_THROUGH_MONTH = `
  SELECT
    (SELECT COALESCE(SUM(opening_balance_cents), 0) FROM accounts WHERE type = 'credit_card' AND archived_at IS NULL AND board_id = ?)
    +
    (SELECT COALESCE(SUM(t.amount_cents), 0) FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.type = 'credit_card' AND a.archived_at IS NULL AND a.board_id = ? AND t.date < ? AND t.date <= ?)
    AS total
`;

export const UPSERT_ASSIGNED_CENTS = `
  INSERT INTO budget_entries (category_id, month, assigned_cents, board_id) VALUES (?, ?, ?, ?)
  ON CONFLICT(category_id, month) DO UPDATE SET assigned_cents = excluded.assigned_cents
`;
