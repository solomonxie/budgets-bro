import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as transactionsRepo from '../db/repositories/transactionsRepo';
import type { TransactionWithLabels } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

export function useTransactions(accountId?: number) {
  const [transactions, setTransactions] = useState<TransactionWithLabels[]>([]);
  const [loading, setLoading] = useState(true);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const list =
      accountId != null
        ? await transactionsRepo.listTransactionsForAccount(db, accountId)
        : await transactionsRepo.listTransactions(db);
    setTransactions(list);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { transactions, loading, refresh };
}
