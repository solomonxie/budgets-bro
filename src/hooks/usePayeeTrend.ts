import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDb } from '../db/client';
import * as reportsRepo from '../db/repositories/reportsRepo';
import type { PayeeTrendPoint } from '../db/repositories/reportsRepo';
import { currentMonth, monthsBetween } from '../domain/month';
import { summarizePayees } from '../domain/payeeTrend';
import type { PayeeSummary } from '../domain/payeeTrend';
import { useAppStore } from '../state/useAppStore';

// The ranking, the shares and the top payee's bars all cover a year — the
// shortest window that holds an annual bill and still says something about
// a weekly habit, and short enough that every number on the page adds up to
// the same period. Open a payee, though, and you get its whole history:
// once you are looking at one of them, "since when" is the question.
export const PAYEE_WINDOW_MONTHS = 12;

export function usePayeeTrend() {
  const [points, setPoints] = useState<PayeeTrendPoint[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([currentMonth()]);
  const [loading, setLoading] = useState(true);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const month = currentMonth();
    const earliest = await reportsRepo.earliestTransactionMonth(db, boardId);
    const months = monthsBetween(earliest ?? month, month);
    setAllMonths(months);
    setPoints(await reportsRepo.spendingByPayeeOverMonths(db, boardId, months));
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  // A board with three months of history gets a three-month window, not
  // nine empty bars in front of it.
  const windowMonths = useMemo(
    () => allMonths.slice(-PAYEE_WINDOW_MONTHS),
    [allMonths],
  );
  const insights = useMemo(
    () => summarizePayees(points, windowMonths),
    [points, windowMonths],
  );
  const history = useMemo(() => {
    const summaries = summarizePayees(points, allMonths).payees;
    return new Map<number, PayeeSummary>(
      summaries.map((payee) => [payee.payeeId, payee]),
    );
  }, [points, allMonths]);

  return { ...insights, months: windowMonths, history, loading };
}
