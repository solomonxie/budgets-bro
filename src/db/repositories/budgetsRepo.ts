import type { SQLiteDatabase } from 'expo-sqlite';
import { nextMonth } from '../../domain/month';

async function sumOrZero(
  db: SQLiteDatabase,
  sql: string,
  ...params: (string | number)[]
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(sql, ...params);
  return row?.total ?? 0;
}

export async function assignedThisMonthByCategory(
  db: SQLiteDatabase,
  month: string,
): Promise<Record<number, number>> {
  const rows = await db.getAllAsync<{ category_id: number; assigned_cents: number }>(
    'SELECT category_id, assigned_cents FROM budget_entries WHERE month = ?',
    month,
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.assigned_cents;
  return map;
}

export async function cumulativeAssignedByCategory(
  db: SQLiteDatabase,
  throughMonth: string,
): Promise<Record<number, number>> {
  const rows = await db.getAllAsync<{ category_id: number; total: number }>(
    'SELECT category_id, SUM(assigned_cents) as total FROM budget_entries WHERE month <= ? GROUP BY category_id',
    throughMonth,
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.total;
  return map;
}

export async function cumulativeActivityByCategory(
  db: SQLiteDatabase,
  throughMonth: string,
): Promise<Record<number, number>> {
  const endExclusive = `${nextMonth(throughMonth)}-01`;
  const rows = await db.getAllAsync<{ category_id: number; total: number }>(
    'SELECT category_id, SUM(amount_cents) as total FROM transactions WHERE category_id IS NOT NULL AND date < ? GROUP BY category_id',
    endExclusive,
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.total;
  return map;
}

export async function activityThisMonthByCategory(db: SQLiteDatabase, month: string): Promise<Record<number, number>> {
  const start = `${month}-01`;
  const endExclusive = `${nextMonth(month)}-01`;
  const rows = await db.getAllAsync<{ category_id: number; total: number }>(
    'SELECT category_id, SUM(amount_cents) as total FROM transactions WHERE category_id IS NOT NULL AND date >= ? AND date < ? GROUP BY category_id',
    start,
    endExclusive,
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[r.category_id] = r.total;
  return map;
}

export async function totalAssignedThroughMonth(db: SQLiteDatabase, throughMonth: string): Promise<number> {
  return sumOrZero(db, 'SELECT SUM(assigned_cents) as total FROM budget_entries WHERE month <= ?', throughMonth);
}

// Signed sum of uncategorized, non-transfer transactions on on-budget
// accounts — includes negative balance-correction amounts on purpose.
export async function totalUncategorizedThroughMonth(db: SQLiteDatabase, throughMonth: string): Promise<number> {
  const endExclusive = `${nextMonth(throughMonth)}-01`;
  return sumOrZero(
    db,
    `SELECT SUM(t.amount_cents) as total FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.category_id IS NULL AND t.transfer_account_id IS NULL AND a.on_budget = 1 AND t.date < ?`,
    endExclusive,
  );
}

export async function setAssignedCents(
  db: SQLiteDatabase,
  categoryId: number,
  month: string,
  assignedCents: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO budget_entries (category_id, month, assigned_cents) VALUES (?, ?, ?)
     ON CONFLICT(category_id, month) DO UPDATE SET assigned_cents = excluded.assigned_cents`,
    categoryId,
    month,
    assignedCents,
  );
}

export async function adjustAssignedCents(
  db: SQLiteDatabase,
  categoryId: number,
  month: string,
  deltaCents: number,
): Promise<void> {
  const current = await sumOrZero(
    db,
    'SELECT assigned_cents as total FROM budget_entries WHERE category_id = ? AND month = ?',
    categoryId,
    month,
  );
  await setAssignedCents(db, categoryId, month, Math.max(0, current + deltaCents));
}
