import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDb } from '../db/client';
import * as reportsRepo from '../db/repositories/reportsRepo';
import type { CategorySpend, CategoryTrendPoint } from '../db/repositories/reportsRepo';
import { lastNMonths } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

const TREND_MONTHS = 12;

export function useInsights(month: string) {
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [trendPoints, setTrendPoints] = useState<CategoryTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const months = lastNMonths(month, TREND_MONTHS);
    const [spendingRows, trendRows] = await Promise.all([
      reportsRepo.spendingByCategory(db, boardId, month),
      reportsRepo.spendingByCategoryOverMonths(db, boardId, months),
    ]);
    setSpending(spendingRows);
    setTrendPoints(trendRows);
    setLoading(false);
  }, [month, boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const trendMonths = useMemo(() => lastNMonths(month, TREND_MONTHS), [month]);

  return { spending, trendPoints, trendMonths, loading };
}
