import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDb } from '../db/client';
import * as scheduledTransactionsRepo from '../db/repositories/scheduledTransactionsRepo';
import * as paymentReviewRepo from '../db/repositories/paymentReviewRepo';
import { addMonths } from '../finance-tools/amortization';
import { buildReviewItems } from '../domain/paymentReview';
import type { AdHocPayee } from '../domain/paymentReview';
import type { ScheduledTransactionWithLabels } from '../domain/types';
import { currentDateISO } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

export function usePaymentReview() {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const [schedules, setSchedules] = useState<ScheduledTransactionWithLabels[]>([]);
  const [adHoc, setAdHoc] = useState<AdHocPayee[]>([]);
  const [loading, setLoading] = useState(true);
  const today = currentDateISO();

  const refresh = useCallback(async () => {
    const db = await getDb();
    const [s, a] = await Promise.all([
      scheduledTransactionsRepo.listForBoard(db, boardId),
      paymentReviewRepo.listAdHoc(db, boardId, addMonths(currentDateISO(), -12)),
    ]);
    setSchedules(s);
    setAdHoc(a);
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const items = useMemo(() => buildReviewItems(schedules, adHoc, today), [schedules, adHoc, today]);
  const dueCount = useMemo(() => items.filter((i) => i.due).length, [items]);

  return { items, dueCount, loading, today };
}
