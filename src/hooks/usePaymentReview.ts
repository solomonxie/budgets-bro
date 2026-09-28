import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDb } from '../db/client';
import * as paymentReviewRepo from '../db/repositories/paymentReviewRepo';
import { addMonths } from '../finance-tools/amortization';
import { DETECTION_WINDOW_MONTHS, buildReviewItems, detectRecurring } from '../domain/paymentReview';
import type { AdHocPayee, PaymentDecision, RepeatedCharge } from '../domain/paymentReview';
import type { ScheduledTransactionWithLabels } from '../domain/types';
import { currentDateISO } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

export function usePaymentReview() {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const [schedules, setSchedules] = useState<ScheduledTransactionWithLabels[]>([]);
  const [adHoc, setAdHoc] = useState<AdHocPayee[]>([]);
  const [repeated, setRepeated] = useState<RepeatedCharge[]>([]);
  const [decisions, setDecisions] = useState<PaymentDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const today = currentDateISO();

  const refresh = useCallback(async () => {
    const db = await getDb();
    const now = currentDateISO();
    const [s, a, r, d] = await Promise.all([
      paymentReviewRepo.listReviewableSchedules(db, boardId),
      paymentReviewRepo.listAdHoc(db, boardId, addMonths(now, -12)),
      paymentReviewRepo.listRepeatedCharges(db, boardId, addMonths(now, -DETECTION_WINDOW_MONTHS)),
      paymentReviewRepo.listDecisions(db, boardId),
    ]);
    setSchedules(s);
    setAdHoc(a);
    setRepeated(r);
    setDecisions(d);
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const items = useMemo(
    () => buildReviewItems(schedules, adHoc, detectRecurring(repeated, today), today),
    [schedules, adHoc, repeated, today],
  );
  const { todo, history } = useMemo(
    () => ({ todo: decisions.filter((d) => d.doneOn == null), history: decisions.filter((d) => d.doneOn != null) }),
    [decisions],
  );
  const dueCount = useMemo(() => items.filter((i) => i.due).length, [items]);
  const todoDueCount = useMemo(() => todo.filter((d) => d.dueOn != null && d.dueOn <= today).length, [todo, today]);

  return { items, todo, history, dueCount, todoDueCount, loading, today };
}
