import type { SQLiteDatabase } from 'expo-sqlite';
import type { CategoryGroupRow, CategoryRow } from '../schema';
import type { Category, CategoryGroup } from '../../domain/types';
import { LIST_CATEGORIES, LIST_CATEGORY_GROUPS, INSERT_CATEGORY, UPDATE_CATEGORY } from '../../../databases/queries/categories';

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
    linkedAccountId: row.linked_account_id,
  };
}

export async function listCategoryGroups(db: SQLiteDatabase): Promise<CategoryGroup[]> {
  const rows = await db.getAllAsync<CategoryGroupRow>(LIST_CATEGORY_GROUPS);
  return rows.map(mapGroupRow);
}

export async function listCategories(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(LIST_CATEGORIES);
  return rows.map(mapCategoryRow);
}

export async function getCategory(db: SQLiteDatabase, id: number): Promise<Category | null> {
  const row = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', id);
  return row ? mapCategoryRow(row) : null;
}

export async function findCategoryByLinkedAccount(db: SQLiteDatabase, accountId: number): Promise<Category | null> {
  const row = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE linked_account_id = ?', accountId);
  return row ? mapCategoryRow(row) : null;
}

export async function findOrCreateCategoryGroup(db: SQLiteDatabase, name: string): Promise<number> {
  const existing = await db.getFirstAsync<CategoryGroupRow>('SELECT * FROM category_groups WHERE name = ?', name);
  if (existing) return existing.id;
  return createCategoryGroup(db, name);
}

export async function findOrCreateCategory(db: SQLiteDatabase, groupId: number, name: string): Promise<number> {
  const existing = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE group_id = ? AND name = ?', groupId, name);
  if (existing) return existing.id;
  return createCategory(db, { groupId, name, icon: null });
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

export async function createCategory(
  db: SQLiteDatabase,
  input: CategoryInput,
  linkedAccountId: number | null = null,
): Promise<number> {
  const result = await db.runAsync(INSERT_CATEGORY, input.groupId, input.name, input.icon, linkedAccountId);
  return result.lastInsertRowId;
}

export async function updateCategory(db: SQLiteDatabase, id: number, input: CategoryInput): Promise<void> {
  await db.runAsync(UPDATE_CATEGORY, input.groupId, input.name, input.icon, id);
}

export async function archiveCategory(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE categories SET archived_at = datetime('now') WHERE id = ?", id);
}

const LOAN_PAYMENTS_GROUP = 'Loan Payments';

// Auto-creates/renames/archives the "Payment: <account>" category a
// loan/mortgage account owns 1:1 — see accountKind.isLoanLikeType.
export async function ensurePaymentCategory(db: SQLiteDatabase, accountId: number, accountName: string): Promise<void> {
  const existing = await findCategoryByLinkedAccount(db, accountId);
  const name = `Payment: ${accountName}`;
  if (existing) {
    if (existing.name !== name) await updateCategory(db, existing.id, { groupId: existing.groupId, name, icon: existing.icon });
    return;
  }
  const groupId = await findOrCreateCategoryGroup(db, LOAN_PAYMENTS_GROUP);
  await createCategory(db, { groupId, name, icon: '🏦' }, accountId);
}

export async function archivePaymentCategory(db: SQLiteDatabase, accountId: number): Promise<void> {
  const existing = await findCategoryByLinkedAccount(db, accountId);
  if (existing) await archiveCategory(db, existing.id);
}
