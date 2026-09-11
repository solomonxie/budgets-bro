export const LIST_CATEGORY_GROUPS = 'SELECT * FROM category_groups WHERE archived_at IS NULL AND board_id = ? ORDER BY sort_order, name';

export const LIST_CATEGORIES = 'SELECT * FROM categories WHERE archived_at IS NULL AND board_id = ? ORDER BY sort_order, name';

export const INSERT_CATEGORY = `
  INSERT INTO categories (board_id, group_id, name, icon, sort_order) VALUES (?, ?, ?, ?, ?)
`;

export const UPDATE_CATEGORY = `
  UPDATE categories SET group_id = ?, name = ?, icon = ? WHERE id = ?
`;
