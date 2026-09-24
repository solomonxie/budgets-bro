import type { SQLiteDatabase } from '../../src/db/driver';

// Loans and mortgages made before 035 have no payment category, so paying
// one from cash would go uncategorised until the account was next edited.
// Each gets one now: its old linked "Payment:" category if it still has one
// (migration 002), otherwise a category named after the account under a
// "Loan Payments" group — what accountsRepo does for a new loan.
export async function up(db: SQLiteDatabase): Promise<void> {
  const loans = await db.getAllAsync<{
    id: number;
    board_id: number;
    name: string;
  }>(
    `SELECT id, board_id, name FROM accounts
     WHERE type IN ('loan', 'mortgage') AND loan_payment_category_id IS NULL AND archived_at IS NULL`,
  );
  for (const loan of loans) {
    const linked = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM categories WHERE linked_account_id = ? AND board_id = ?',
      loan.id,
      loan.board_id,
    );
    const categoryId =
      linked?.id ??
      (await findOrCreateCategory(db, loan.board_id, loan.name.trim()));
    await db.runAsync(
      'UPDATE accounts SET loan_payment_category_id = ? WHERE id = ?',
      categoryId,
      loan.id,
    );
  }
}

async function findOrCreateCategory(
  db: SQLiteDatabase,
  boardId: number,
  name: string,
): Promise<number> {
  let group = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM category_groups WHERE name = ? AND board_id = ?',
    'Loan Payments',
    boardId,
  );
  if (!group) {
    const order = await db.getFirstAsync<{ max: number | null }>(
      'SELECT MAX(sort_order) as max FROM category_groups WHERE board_id = ?',
      boardId,
    );
    const inserted = await db.runAsync(
      'INSERT INTO category_groups (board_id, name, sort_order) VALUES (?, ?, ?)',
      boardId,
      'Loan Payments',
      (order?.max ?? -1) + 1,
    );
    group = { id: inserted.lastInsertRowId };
  }
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE group_id = ? AND name = ? AND board_id = ?',
    group.id,
    name,
    boardId,
  );
  if (existing) return existing.id;
  const order = await db.getFirstAsync<{ max: number | null }>(
    'SELECT MAX(sort_order) as max FROM categories WHERE group_id = ?',
    group.id,
  );
  const inserted = await db.runAsync(
    'INSERT INTO categories (board_id, group_id, name, icon, sort_order) VALUES (?, ?, ?, NULL, ?)',
    boardId,
    group.id,
    name,
    (order?.max ?? -1) + 1,
  );
  return inserted.lastInsertRowId;
}
