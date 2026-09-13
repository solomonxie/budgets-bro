import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as scheduledTransactionsRepo from '../db/repositories/scheduledTransactionsRepo';
import type { ScheduledTransactionWithLabels } from '../domain/types';
import { currentDateISO } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

// Schedules due for approval (see scheduledTransactionsRepo.approveOccurrence)
// — surfaced as a badge under Budget board's Spent This Month box. No
// schedule posts itself anymore; this is the only path from "due" to an
// actual row in `transactions`.
export function usePendingScheduledTransactions() {
  const [pending, setPending] = useState<ScheduledTransactionWithLabels[]>([]);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setPending(await scheduledTransactionsRepo.listDue(db, boardId, currentDateISO()));
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const approve = useCallback(
    async (id: number) => {
      const db = await getDb();
      await scheduledTransactionsRepo.approveOccurrence(db, boardId, id);
      bumpDataVersion();
    },
    [boardId, bumpDataVersion],
  );

  return { pending, approve, refresh };
}
