import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as incomeRepo from '../db/repositories/incomeRepo';
import { useAppStore } from '../state/useAppStore';

// Powers the Accounts list's Income group — this year's total per income
// account, computed once for the whole board instead of one query each.
export function useIncomeAccountYearTotals() {
  const [totalsByAccountId, setTotalsByAccountId] = useState<Map<number, number>>(new Map());
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setTotalsByAccountId(await incomeRepo.thisYearTotalsByBoard(db, boardId));
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { totalsByAccountId, refresh };
}
