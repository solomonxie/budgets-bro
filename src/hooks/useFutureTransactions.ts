import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as transactionsRepo from '../db/repositories/transactionsRepo';
import type { TransactionWithLabels } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

// Powers the account page's "Scheduled" box — transactions dated after
// today, deliberately kept out of useTransactions()'s list (see
// transactionsRepo.listFutureTransactionsForAccount).
export function useFutureTransactions(accountId: number) {
  const [futureTransactions, setFutureTransactions] = useState<
    TransactionWithLabels[]
  >([]);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setFutureTransactions(
      await transactionsRepo.listFutureTransactionsForAccount(
        db,
        boardId,
        accountId,
      ),
    );
  }, [accountId, boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { futureTransactions, refresh };
}
