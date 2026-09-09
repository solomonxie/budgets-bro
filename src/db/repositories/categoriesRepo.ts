import type { SQLiteDatabase } from 'expo-sqlite';
import type { CategoryGroupRow, CategoryRow } from '../schema';
import type { Category, CategoryGroup } from '../../domain/types';

function mapGroupRow(row: CategoryGroupRow): CategoryGroup {
  return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    icon: row.icon,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
  };
}

export async function listCategoryGroups(db: SQLiteDatabase): Promise<CategoryGroup[]> {
  const rows = await db.getAllAsync<CategoryGroupRow>('SELECT * FROM category_groups ORDER BY sort_order, name');
  return rows.map(mapGroupRow);
}

export async function listCategories(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories WHERE archived_at IS NULL ORDER BY sort_order, name',
  );
  return rows.map(mapCategoryRow);
}

export async function createCategoryGroup(db: SQLiteDatabase, name: string): Promise<number> {
  const result = await db.runAsync('INSERT INTO category_groups (name) VALUES (?)', name);
  return result.lastInsertRowId;
}

export interface CategoryInput {
  groupId: number;
  name: string;
  icon: string | null;
}

export async function createCategory(db: SQLiteDatabase, input: CategoryInput): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO categories (group_id, name, icon) VALUES (?, ?, ?)',
    input.groupId,
    input.name,
    input.icon,
  );
  return result.lastInsertRowId;
}

export async function updateCategory(db: SQLiteDatabase, id: number, input: CategoryInput): Promise<void> {
  await db.runAsync(
    'UPDATE categories SET group_id = ?, name = ?, icon = ? WHERE id = ?',
    input.groupId,
    input.name,
    input.icon,
    id,
  );
}

export async function archiveCategory(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE categories SET archived_at = datetime('now') WHERE id = ?", id);
}
