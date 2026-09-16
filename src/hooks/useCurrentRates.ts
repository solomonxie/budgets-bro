import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as accountRateHistoryRepo from '../db/repositories/accountRateHistoryRepo';
import { useAppStore } from '../state/useAppStore';

// Current rate for every account on the board in one query — for screens that
// list several loans at once. A single account's rate (and its full history)
// still goes through useAccountRateHistory.
export function useCurrentRates() {
  const [ratesByAccountId, setRatesByAccountId] = useState<Map<number, number>>(new Map());
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setRatesByAccountId(await accountRateHistoryRepo.currentRatesByBoard(db, boardId));
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { ratesByAccountId, refresh };
}
