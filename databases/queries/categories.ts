export const LIST_CATEGORY_GROUPS = 'SELECT * FROM category_groups WHERE archived_at IS NULL ORDER BY sort_order, name';

export const LIST_CATEGORIES = 'SELECT * FROM categories WHERE archived_at IS NULL ORDER BY sort_order, name';

export const INSERT_CATEGORY = `
  INSERT INTO categories (group_id, name, icon, linked_account_id, sort_order) VALUES (?, ?, ?, ?, ?)
`;

export const UPDATE_CATEGORY = `
  UPDATE categories SET group_id = ?, name = ?, icon = ? WHERE id = ?
`;

export const ARCHIVE_CATEGORIES_IN_GROUP = "UPDATE categories SET archived_at = datetime('now') WHERE group_id = ? AND archived_at IS NULL";
