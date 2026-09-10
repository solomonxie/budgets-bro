import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as payeesRepo from '../db/repositories/payeesRepo';
import type { Payee } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

export function usePayees() {
  const [payees, setPayees] = useState<Payee[]>([]);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setPayees(await payeesRepo.listPayees(db));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { payees, refresh };
}
