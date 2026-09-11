import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as accountHouseValueHistoryRepo from '../db/repositories/accountHouseValueHistoryRepo';
import type { AccountHouseValueChange } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

export function useAccountHouseValueHistory(accountId: number | null) {
  const [history, setHistory] = useState<AccountHouseValueChange[]>([]);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const refresh = useCallback(async () => {
    if (accountId == null) {
      setHistory([]);
      return;
    }
    const db = await getDb();
    setHistory(await accountHouseValueHistoryRepo.listHouseValueHistory(db, accountId));
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const currentValueCents = history[0]?.valueCents ?? null;

  return { history, currentValueCents, refresh };
}
