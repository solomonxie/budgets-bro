import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as scheduledTransactionsRepo from '../db/repositories/scheduledTransactionsRepo';
import type { ScheduledTransactionWithLabels } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

// Powers the account page's "Scheduled" box, which doubles as schedule
// management — see AccountDetailScreen. Unlike usePendingScheduledTransactions
// (Budget board, only what's due), this lists every recurring schedule on
// the account regardless of next_date, so upcoming-but-not-yet-due ones are
// still visible with their next date.
export function useAccountScheduledTransactions(accountId: number) {
  const [scheduledTransactions, setScheduledTransactions] = useState<ScheduledTransactionWithLabels[]>([]);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setScheduledTransactions(await scheduledTransactionsRepo.listForAccount(db, accountId));
  }, [accountId]);

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

  const cancel = useCallback(
    async (id: number) => {
      const db = await getDb();
      await scheduledTransactionsRepo.deleteScheduledTransaction(db, id);
      bumpDataVersion();
    },
    [bumpDataVersion],
  );

  return { scheduledTransactions, approve, cancel };
}
