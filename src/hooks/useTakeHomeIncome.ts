import { useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as reportsRepo from '../db/repositories/reportsRepo';
import { currentMonth, previousMonth } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

const MONTHS = 3;

// Average monthly income over the last three full months — the same figure
// Baby Steps reads. Paychecks land net, so this is take-home. Not queried
// until `enabled`, so a folded section costs nothing.
export function useTakeHomeIncome(enabled: boolean): number | null {
  const [cents, setCents] = useState<number | null>(null);
  const boardId = useAppStore((s) => s.currentBoardId);
  const dataVersion = useAppStore((s) => s.dataVersion);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const month = currentMonth();
      let start = month;
      for (let i = 0; i < MONTHS; i++) start = previousMonth(start);
      const totals = await reportsRepo.incomeAndSpendingInRange(
        await getDb(),
        boardId,
        `${start}-01`,
        `${month}-01`,
      );
      if (!cancelled) setCents(Math.round(totals.incomeCents / MONTHS));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, boardId, dataVersion]);

  return cents;
}
