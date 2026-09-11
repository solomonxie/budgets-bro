import type { SQLiteDatabase } from 'expo-sqlite';
import type { CategoryGroupRow, CategoryRow } from '../schema';
import type { Category, CategoryGroup } from '../../domain/types';
import {
  LIST_CATEGORIES,
  LIST_CATEGORY_GROUPS,
  INSERT_CATEGORY,
  UPDATE_CATEGORY,
  ARCHIVE_CATEGORIES_IN_GROUP,
} from '../../../databases/queries/categories';

function mapGroupRow(row: CategoryGroupRow): CategoryGroup {
  return { id: row.id, name: row.name, sortOrder: row.sort_order, archivedAt: row.archived_at };
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

export async function listCategoryGroups(db: SQLiteDatabase, boardId: number): Promise<CategoryGroup[]> {
  const rows = await db.getAllAsync<CategoryGroupRow>(LIST_CATEGORY_GROUPS, boardId);
  return rows.map(mapGroupRow);
}

export async function listCategories(db: SQLiteDatabase, boardId: number): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(LIST_CATEGORIES, boardId);
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

export async function findOrCreateCategoryGroup(db: SQLiteDatabase, boardId: number, name: string): Promise<number> {
  const existing = await db.getFirstAsync<CategoryGroupRow>(
    'SELECT * FROM category_groups WHERE name = ? AND board_id = ?',
    name,
    boardId,
  );
  if (existing) return existing.id;
  return createCategoryGroup(db, boardId, name);
}

export async function findOrCreateCategory(db: SQLiteDatabase, boardId: number, groupId: number, name: string): Promise<number> {
  const existing = await db.getFirstAsync<CategoryRow>(
    'SELECT * FROM categories WHERE group_id = ? AND name = ? AND board_id = ?',
    groupId,
    name,
    boardId,
  );
  if (existing) return existing.id;
  return createCategory(db, boardId, { groupId, name, icon: null });
}

async function nextSortOrder(db: SQLiteDatabase, boardId: number, table: 'categories' | 'category_groups', groupId?: number): Promise<number> {
  const row =
    table === 'categories'
      ? await db.getFirstAsync<{ max: number | null }>('SELECT MAX(sort_order) as max FROM categories WHERE group_id = ?', groupId!)
      : await db.getFirstAsync<{ max: number | null }>('SELECT MAX(sort_order) as max FROM category_groups WHERE board_id = ?', boardId);
  return (row?.max ?? -1) + 1;
}

export async function createCategoryGroup(db: SQLiteDatabase, boardId: number, name: string): Promise<number> {
  const sortOrder = await nextSortOrder(db, boardId, 'category_groups');
  const result = await db.runAsync('INSERT INTO category_groups (board_id, name, sort_order) VALUES (?, ?, ?)', boardId, name, sortOrder);
  return result.lastInsertRowId;
}

export interface CategoryInput {
  groupId: number;
  name: string;
  icon: string | null;
}

export async function createCategory(
  db: SQLiteDatabase,
  boardId: number,
  input: CategoryInput,
  linkedAccountId: number | null = null,
): Promise<number> {
  const sortOrder = await nextSortOrder(db, boardId, 'categories', input.groupId);
  const result = await db.runAsync(INSERT_CATEGORY, boardId, input.groupId, input.name, input.icon, linkedAccountId, sortOrder);
  return result.lastInsertRowId;
}

export async function updateCategory(db: SQLiteDatabase, id: number, input: CategoryInput): Promise<void> {
  await db.runAsync(UPDATE_CATEGORY, input.groupId, input.name, input.icon, id);
}

// Renaming doesn't touch `icon` — categories no longer get icons from a
// picker (the user types an emoji straight into the name), but this must
// not blank out a legacy category's icon (e.g. the auto-generated loan
// payment category's 🏦).
export async function renameCategory(db: SQLiteDatabase, id: number, name: string): Promise<void> {
  await db.runAsync('UPDATE categories SET name = ? WHERE id = ?', name, id);
}

export async function renameCategoryGroup(db: SQLiteDatabase, id: number, name: string): Promise<void> {
  await db.runAsync('UPDATE category_groups SET name = ? WHERE id = ?', name, id);
}

export async function archiveCategory(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE categories SET archived_at = datetime('now') WHERE id = ?", id);
}

export async function archiveCategoryGroup(db: SQLiteDatabase, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(ARCHIVE_CATEGORIES_IN_GROUP, id);
    await db.runAsync("UPDATE category_groups SET archived_at = datetime('now') WHERE id = ?", id);
  });
}

export type MoveDirection = 'up' | 'down';

// Renumbers the whole sibling set to its post-move order rather than
// swapping two raw sort_order values — self-healing for rows created
// before sort_order was assigned on insert (they'd otherwise all tie at 0
// and a value-swap between two zeros would be a no-op).
async function reorder(
  db: SQLiteDatabase,
  table: 'categories' | 'category_groups',
  orderedIds: number[],
  id: number,
  direction: MoveDirection,
): Promise<void> {
  const index = orderedIds.indexOf(id);
  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= orderedIds.length) return;
  const next = [...orderedIds];
  [next[index], next[neighborIndex]] = [next[neighborIndex], next[index]];
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < next.length; i++) {
      await db.runAsync(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, i, next[i]);
    }
  });
}

export async function moveCategory(db: SQLiteDatabase, boardId: number, categoryId: number, direction: MoveDirection): Promise<void> {
  const category = await getCategory(db, categoryId);
  if (!category) return;
  const siblingIds = (await listCategories(db, boardId)).filter((c) => c.groupId === category.groupId).map((c) => c.id);
  await reorder(db, 'categories', siblingIds, categoryId, direction);
}

export async function moveCategoryGroup(db: SQLiteDatabase, boardId: number, groupId: number, direction: MoveDirection): Promise<void> {
  const groupIds = (await listCategoryGroups(db, boardId)).map((g) => g.id);
  await reorder(db, 'category_groups', groupIds, groupId, direction);
}

const LOAN_PAYMENTS_GROUP = 'Loan Payments';

// Auto-creates/renames/archives the "Payment: <account>" category a
// loan/mortgage account owns 1:1 — see accountKind.isLoanLikeType.
export async function ensurePaymentCategory(db: SQLiteDatabase, boardId: number, accountId: number, accountName: string): Promise<void> {
  const existing = await findCategoryByLinkedAccount(db, accountId);
  const name = `Payment: ${accountName}`;
  if (existing) {
    if (existing.name !== name) await renameCategory(db, existing.id, name);
    return;
  }
  const groupId = await findOrCreateCategoryGroup(db, boardId, LOAN_PAYMENTS_GROUP);
  await createCategory(db, boardId, { groupId, name, icon: '🏦' }, accountId);
}

export async function archivePaymentCategory(db: SQLiteDatabase, accountId: number): Promise<void> {
  const existing = await findCategoryByLinkedAccount(db, accountId);
  if (existing) await archiveCategory(db, existing.id);
}
