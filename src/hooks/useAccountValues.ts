import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as accountValueHistoryRepo from '../db/repositories/accountValueHistoryRepo';
import { useAppStore } from '../state/useAppStore';

// Board-wide current value per account (mortgage house value or a tracking
// account's logged value), keyed by account id — feeds Net Worth without a
// per-account round trip.
export function useAccountValues() {
  const [valuesByAccountId, setValuesByAccountId] = useState<Map<number, number>>(new Map());
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setValuesByAccountId(await accountValueHistoryRepo.currentValuesByBoard(db, boardId));
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { valuesByAccountId, refresh };
}
