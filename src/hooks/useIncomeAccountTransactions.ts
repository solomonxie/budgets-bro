import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as transactionsRepo from '../db/repositories/transactionsRepo';
import type { TransactionWithLabels } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

// An Income account's own "transactions" are a filtered view over whatever
// real accounts the money actually landed in (see migration 021) — the
// income-account counterpart to useTransactions.
export function useIncomeAccountTransactions(incomeAccountId: number | null) {
  const [transactions, setTransactions] = useState<TransactionWithLabels[]>([]);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    if (incomeAccountId == null) {
      setTransactions([]);
      return;
    }
    const db = await getDb();
    setTransactions(await transactionsRepo.listTransactionsForIncomeAccount(db, boardId, incomeAccountId));
  }, [incomeAccountId, boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { transactions, refresh };
}
