import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as scheduledTransactionsRepo from '../db/repositories/scheduledTransactionsRepo';
import type { ScheduledTransactionWithLabels } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

export function useScheduledTransactions() {
  const [scheduledTransactions, setScheduledTransactions] = useState<ScheduledTransactionWithLabels[]>([]);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setScheduledTransactions(await scheduledTransactionsRepo.listForBoard(db, boardId));
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { scheduledTransactions, refresh };
}
