export const LIST_CATEGORY_GROUPS = 'SELECT * FROM category_groups ORDER BY sort_order, name';

export const LIST_CATEGORIES = 'SELECT * FROM categories WHERE archived_at IS NULL ORDER BY sort_order, name';

export const INSERT_CATEGORY = `
  INSERT INTO categories (group_id, name, icon, linked_account_id) VALUES (?, ?, ?, ?)
`;

export const UPDATE_CATEGORY = `
  UPDATE categories SET group_id = ?, name = ?, icon = ? WHERE id = ?
`;
