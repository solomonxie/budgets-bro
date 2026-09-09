import type { SQLiteDatabase } from 'expo-sqlite';
import { nextMonth } from '../../domain/month';

export interface CategorySpend {
  categoryId: number;
  name: string;
  icon: string | null;
  spentCents: number;
}

export async function spendingByCategory(db: SQLiteDatabase, month: string): Promise<CategorySpend[]> {
  const start = `${month}-01`;
  const endExclusive = `${nextMonth(month)}-01`;
  const rows = await db.getAllAsync<{ category_id: number; name: string; icon: string | null; total: number }>(
    `SELECT c.id as category_id, c.name, c.icon, SUM(-t.amount_cents) as total
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.amount_cents < 0 AND t.date >= ? AND t.date < ? AND t.transfer_account_id IS NULL
     GROUP BY c.id ORDER BY total DESC`,
    start,
    endExclusive,
  );
  return rows.map((r) => ({ categoryId: r.category_id, name: r.name, icon: r.icon, spentCents: r.total }));
}

export interface MonthTotals {
  month: string;
  incomeCents: number;
  spendingCents: number;
}

export async function monthlyTotals(db: SQLiteDatabase, months: string[]): Promise<MonthTotals[]> {
  const results: MonthTotals[] = [];
  for (const month of months) {
    const start = `${month}-01`;
    const endExclusive = `${nextMonth(month)}-01`;
    const income = await db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(t.amount_cents) as total FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE t.amount_cents > 0 AND t.transfer_account_id IS NULL AND a.on_budget = 1 AND t.date >= ? AND t.date < ?`,
      start,
      endExclusive,
    );
    const spending = await db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(-t.amount_cents) as total FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE t.amount_cents < 0 AND t.transfer_account_id IS NULL AND a.on_budget = 1 AND t.date >= ? AND t.date < ?`,
      start,
      endExclusive,
    );
    results.push({ month, incomeCents: income?.total ?? 0, spendingCents: spending?.total ?? 0 });
  }
  return results;
}

export async function interestEarned(db: SQLiteDatabase, month: string): Promise<number> {
  const start = `${month}-01`;
  const endExclusive = `${nextMonth(month)}-01`;
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(amount_cents) as total FROM transactions WHERE is_interest = 1 AND date >= ? AND date < ?',
    start,
    endExclusive,
  );
  return row?.total ?? 0;
}
