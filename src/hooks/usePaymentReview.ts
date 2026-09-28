import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDb } from '../db/client';
import * as paymentReviewRepo from '../db/repositories/paymentReviewRepo';
import { addMonths } from '../finance-tools/amortization';
import { DETECTION_WINDOW_MONTHS, buildReviewItems, detectRecurring } from '../domain/paymentReview';
import type { AdHocPayee, RepeatedCharge } from '../domain/paymentReview';
import type { ScheduledTransactionWithLabels } from '../domain/types';
import { currentDateISO } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

export function usePaymentReview() {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const [schedules, setSchedules] = useState<ScheduledTransactionWithLabels[]>([]);
  const [adHoc, setAdHoc] = useState<AdHocPayee[]>([]);
  const [repeated, setRepeated] = useState<RepeatedCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const today = currentDateISO();

  const refresh = useCallback(async () => {
    const db = await getDb();
    const today = currentDateISO();
    const [s, a, r] = await Promise.all([
      paymentReviewRepo.listReviewableSchedules(db, boardId),
      paymentReviewRepo.listAdHoc(db, boardId, addMonths(today, -12)),
      paymentReviewRepo.listRepeatedCharges(db, boardId, addMonths(today, -DETECTION_WINDOW_MONTHS)),
    ]);
    setSchedules(s);
    setAdHoc(a);
    setRepeated(r);
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const items = useMemo(
    () => buildReviewItems(schedules, adHoc, detectRecurring(repeated, today), today),
    [schedules, adHoc, repeated, today],
  );
  const dueCount = useMemo(() => items.filter((i) => i.due).length, [items]);

  return { items, dueCount, loading, today };
}
