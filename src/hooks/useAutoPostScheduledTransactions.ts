import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { getDb } from '../db/client';
import * as transactionsRepo from '../db/repositories/transactionsRepo';
import * as scheduledTransactionsRepo from '../db/repositories/scheduledTransactionsRepo';
import { nextOccurrenceDate } from '../domain/recurrence';
import { currentDateISO } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

// Caps how many missed occurrences a single auto-post schedule catches up
// on foreground — a safety valve against an old/stale `next_date` (e.g. a
// weekly schedule left untouched for years) looping effectively forever.
const MAX_CATCHUP_OCCURRENCES = 366;

// Auto-post schedules (T8.8) post themselves lazily — checked on mount and
// whenever the app returns to the foreground, same "while the app happens
// to be open" model as useAutoCloudSync (no real OS background job; see
// docs/DESIGN.md's Recurring Transactions section). Mounted once near the
// app root, alongside useAutoCloudSync.
export function useAutoPostScheduledTransactions() {
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);

  const runAutoPost = useCallback(async () => {
    const db = await getDb();
    const today = currentDateISO();
    const due = await scheduledTransactionsRepo.listDueAutoPost(db, boardId, today);
    if (due.length === 0) return;

    for (const s of due) {
      let nextDate = s.nextDate;
      let posted = false;
      for (let i = 0; i < MAX_CATCHUP_OCCURRENCES && nextDate <= today; i++) {
        await transactionsRepo.createTransaction(db, boardId, {
          accountId: s.accountId,
          categoryId: s.categoryId,
          payeeName: s.payeeName ?? '',
          memo: s.memo,
          amountCents: s.amountCents,
          date: nextDate,
        });
        posted = true;
        nextDate = nextOccurrenceDate(nextDate, s.frequency, s.intervalN, s.daysOfWeekMask, s.createdAt.slice(0, 10));
        if (s.endDate != null && nextDate > s.endDate) break;
      }
      if (!posted) continue;
      if (s.endDate != null && nextDate > s.endDate) await scheduledTransactionsRepo.deleteScheduledTransaction(db, s.id);
      else await scheduledTransactionsRepo.setNextDate(db, s.id, nextDate);
    }
    bumpDataVersion();
  }, [boardId, bumpDataVersion]);

  useEffect(() => {
    runAutoPost();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runAutoPost();
    });
    return () => sub.remove();
  }, [runAutoPost]);
}
