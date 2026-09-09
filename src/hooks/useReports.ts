import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as reportsRepo from '../db/repositories/reportsRepo';
import type { CategorySpend, MonthTotals } from '../db/repositories/reportsRepo';
import { lastNMonths } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

export function useReports(month: string) {
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [trend, setTrend] = useState<MonthTotals[]>([]);
  const [interestCents, setInterestCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const months = lastNMonths(month, 4);
    const [spendingRows, trendRows, interest] = await Promise.all([
      reportsRepo.spendingByCategory(db, month),
      reportsRepo.monthlyTotals(db, months),
      reportsRepo.interestEarned(db, month),
    ]);
    setSpending(spendingRows);
    setTrend(trendRows);
    setInterestCents(interest);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { spending, trend, interestCents, loading };
}
