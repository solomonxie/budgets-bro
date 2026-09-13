import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as incomeRepo from '../db/repositories/incomeRepo';
import { currentMonth, lastNMonths, nextMonth } from '../domain/month';
import { useAppStore } from '../state/useAppStore';
import type { IncomeTrendPoint } from '../screens/accounts/IncomeTrendChart';

const TREND_MONTHS = 12;

export function useIncomeInsights(accountId: number | null) {
  const [thisMonthCents, setThisMonthCents] = useState(0);
  const [thisYearCents, setThisYearCents] = useState(0);
  const [trend, setTrend] = useState<IncomeTrendPoint[]>([]);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    if (accountId == null) {
      setThisMonthCents(0);
      setThisYearCents(0);
      setTrend([]);
      return;
    }
    const db = await getDb();
    const month = currentMonth();
    const year = month.slice(0, 4);
    const months = lastNMonths(month, TREND_MONTHS);
    const [monthTotal, yearTotal, monthlyRows] = await Promise.all([
      incomeRepo.incomeTotalForAccountInRange(db, boardId, accountId, `${month}-01`, `${nextMonth(month)}-01`),
      incomeRepo.incomeTotalForAccountInRange(db, boardId, accountId, `${year}-01-01`, `${Number(year) + 1}-01-01`),
      incomeRepo.monthlyIncomeForAccount(db, boardId, accountId, months[0], months[months.length - 1]),
    ]);
    setThisMonthCents(monthTotal);
    setThisYearCents(yearTotal);
    // Re-index onto every month in the window — the query only returns
    // months with a nonzero sum, and a bar chart needs an explicit $0 for
    // a quiet month rather than skipping straight to the next one.
    const totalsByMonth = new Map(monthlyRows.map((r) => [r.month, r.totalCents]));
    setTrend(months.map((m) => ({ month: m, totalCents: totalsByMonth.get(m) ?? 0 })));
  }, [accountId, boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { thisMonthCents, thisYearCents, trend, refresh };
}
