import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as accountsRepo from '../db/repositories/accountsRepo';
import type { AccountWithBalance } from '../db/repositories/accountsRepo';
import { useAppStore } from '../state/useAppStore';

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setAccounts(await accountsRepo.listAccountsWithBalances(db));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { accounts, loading, refresh };
}
