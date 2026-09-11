export const LIST_BOARDS = 'SELECT * FROM boards ORDER BY id';

export const DELETE_BOARD_CASCADE = [
  'DELETE FROM transactions WHERE board_id = ?',
  'DELETE FROM budget_entries WHERE board_id = ?',
  'DELETE FROM categories WHERE board_id = ?',
  'DELETE FROM category_groups WHERE board_id = ?',
  'DELETE FROM payees WHERE board_id = ?',
  'DELETE FROM accounts WHERE board_id = ?',
  'DELETE FROM boards WHERE id = ?',
];
