import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as customGoalsRepo from '../db/repositories/customGoalsRepo';
import type { CustomGoalWithProgress } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

export function useCustomGoals() {
  const [goals, setGoals] = useState<CustomGoalWithProgress[]>([]);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setGoals(await customGoalsRepo.listForBoard(db, boardId));
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { goals, refresh };
}
