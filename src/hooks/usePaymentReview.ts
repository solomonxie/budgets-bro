import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDb } from '../db/client';
import * as paymentReviewRepo from '../db/repositories/paymentReviewRepo';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { addMonths } from '../finance-tools/amortization';
import { DETECTION_WINDOW_MONTHS, NO_REVIEW_FILTER, applyReviewFilter, buildReviewItems, detectRecurring } from '../domain/paymentReview';
import type { PaymentDecision, RepeatedCharge, ReviewFilter } from '../domain/paymentReview';
import type { ScheduledTransactionWithLabels } from '../domain/types';
import { currentDateISO } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

const filterKey = (boardId: number) => `qbr.excluded:${boardId}`;

export function usePaymentReview() {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const [schedules, setSchedules] = useState<ScheduledTransactionWithLabels[]>([]);
  const [repeated, setRepeated] = useState<RepeatedCharge[]>([]);
  const [decisions, setDecisions] = useState<PaymentDecision[]>([]);
  const [filter, setFilterState] = useState<ReviewFilter>(NO_REVIEW_FILTER);
  const [loading, setLoading] = useState(true);
  const today = currentDateISO();

  const refresh = useCallback(async () => {
    const db = await getDb();
    const now = currentDateISO();
    const [s, r, d, f] = await Promise.all([
      paymentReviewRepo.listReviewableSchedules(db, boardId),
      paymentReviewRepo.listRepeatedCharges(db, boardId, addMonths(now, -DETECTION_WINDOW_MONTHS), now),
      paymentReviewRepo.listDecisions(db, boardId),
      settingsRepo.getJsonSetting(db, filterKey(boardId), NO_REVIEW_FILTER),
    ]);
    setSchedules(s);
    setRepeated(r);
    setDecisions(d);
    setFilterState(f);
    setLoading(false);
  }, [boardId]);

  const setFilter = useCallback(
    async (next: ReviewFilter) => {
      setFilterState(next);
      await settingsRepo.setJsonSetting(await getDb(), filterKey(boardId), next);
    },
    [boardId],
  );

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  // Everything found, before the filter — what the filter pickers list.
  const allItems = useMemo(
    () => buildReviewItems(schedules, detectRecurring(repeated, today), today),
    [schedules, repeated, today],
  );
  const items = useMemo(() => applyReviewFilter(allItems, filter), [allItems, filter]);
  const { todo, history } = useMemo(
    () => ({ todo: decisions.filter((d) => d.doneOn == null), history: decisions.filter((d) => d.doneOn != null) }),
    [decisions],
  );
  const dueCount = useMemo(() => items.filter((i) => i.due).length, [items]);
  const todoDueCount = useMemo(() => todo.filter((d) => d.dueOn != null && d.dueOn <= today).length, [todo, today]);

  return { allItems, items, filter, setFilter, todo, history, dueCount, todoDueCount, loading, today };
}
