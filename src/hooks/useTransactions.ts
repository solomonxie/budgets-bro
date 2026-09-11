import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as transactionsRepo from '../db/repositories/transactionsRepo';
import type { TransactionWithLabels } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

export function useTransactions(accountId?: number) {
  const [transactions, setTransactions] = useState<TransactionWithLabels[]>([]);
  const [loading, setLoading] = useState(true);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const list =
      accountId != null
        ? await transactionsRepo.listTransactionsForAccount(db, boardId, accountId)
        : await transactionsRepo.listTransactions(db, boardId);
    setTransactions(list);
    setLoading(false);
  }, [accountId, boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { transactions, loading, refresh };
}
