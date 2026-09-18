import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as accountValueHistoryRepo from '../db/repositories/accountValueHistoryRepo';
import type { AccountValueChange, AccountValueKind } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

export function useAccountValueHistory(accountId: number | null, kind: AccountValueKind = 'value') {
  const [history, setHistory] = useState<AccountValueChange[]>([]);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const refresh = useCallback(async () => {
    if (accountId == null) {
      setHistory([]);
      return;
    }
    const db = await getDb();
    setHistory(await accountValueHistoryRepo.listValueHistory(db, accountId, kind));
  }, [accountId, kind]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const currentValueCents = history[0]?.valueCents ?? null;

  return { history, currentValueCents, refresh };
}
