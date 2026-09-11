import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as accountHouseValueHistoryRepo from '../db/repositories/accountHouseValueHistoryRepo';
import { useAppStore } from '../state/useAppStore';

// Board-wide current house value per mortgage account, keyed by account id
// — feeds Net Worth without a per-account round trip.
export function useAccountHouseValues() {
  const [valuesByAccountId, setValuesByAccountId] = useState<Map<number, number>>(new Map());
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setValuesByAccountId(await accountHouseValueHistoryRepo.currentHouseValuesByBoard(db, boardId));
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { valuesByAccountId, refresh };
}
