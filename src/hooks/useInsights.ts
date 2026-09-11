import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as reportsRepo from '../db/repositories/reportsRepo';
import type { CategorySpend, CategoryTrendPoint } from '../db/repositories/reportsRepo';
import { monthsBetween } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

export function useInsights(month: string) {
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [trendPoints, setTrendPoints] = useState<CategoryTrendPoint[]>([]);
  const [trendMonths, setTrendMonths] = useState<string[]>([month]);
  const [loading, setLoading] = useState(true);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const earliest = await reportsRepo.earliestTransactionMonth(db, boardId);
    const months = monthsBetween(earliest ?? month, month);
    const [spendingRows, trendRows] = await Promise.all([
      reportsRepo.spendingByCategory(db, boardId, month),
      reportsRepo.spendingByCategoryOverMonths(db, boardId, months),
    ]);
    setSpending(spendingRows);
    setTrendPoints(trendRows);
    setTrendMonths(months);
    setLoading(false);
  }, [month, boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { spending, trendPoints, trendMonths, loading };
}
