import { useEffect, useMemo, useState } from 'react';
import { getDb } from '../db/client';
import { currentDateISO, currentMonth, monthsBetween } from '../domain/month';
import { runwayTrend } from '../domain/runway';
import type { RunwayMonth, RunwayPoint } from '../domain/runway';
import { useAppStore } from '../state/useAppStore';
import { RUNWAY_MONTHLY, RUNWAY_OPENING } from '../../databases/queries/reports';

// Two aggregate queries — one row per month — then the running balance and
// averages in memory.
export function useRunway(): RunwayPoint[] {
  const boardId = useAppStore((s) => s.currentBoardId);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const [inputs, setInputs] = useState<{
    openingCents: number;
    activity: RunwayMonth[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await getDb();
      const [opening, rows] = await Promise.all([
        db.getFirstAsync<{ total: number }>(RUNWAY_OPENING, boardId),
        db.getAllAsync<{ month: string; net: number; cost: number }>(
          RUNWAY_MONTHLY,
          boardId,
          currentDateISO(),
        ),
      ]);
      if (cancelled) return;
      setInputs({
        openingCents: opening?.total ?? 0,
        activity: rows.map((r) => ({
          month: r.month,
          netCents: r.net,
          costCents: r.cost,
        })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, dataVersion]);

  return useMemo(() => {
    if (!inputs || inputs.activity.length === 0) return [];
    const month = currentMonth();
    return runwayTrend({
      months: monthsBetween(inputs.activity[0].month, month),
      openingCents: inputs.openingCents,
      activity: inputs.activity,
      currentMonth: month,
    });
  }, [inputs]);
}
