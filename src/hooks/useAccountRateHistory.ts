import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as accountRateHistoryRepo from '../db/repositories/accountRateHistoryRepo';
import type { AccountRateChange } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

export function useAccountRateHistory(accountId: number | null) {
  const [history, setHistory] = useState<AccountRateChange[]>([]);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const refresh = useCallback(async () => {
    if (accountId == null) {
      setHistory([]);
      return;
    }
    const db = await getDb();
    setHistory(await accountRateHistoryRepo.listRateHistory(db, accountId));
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const currentRateBps = history[0]?.rateBps ?? null;

  return { history, currentRateBps, refresh };
}
