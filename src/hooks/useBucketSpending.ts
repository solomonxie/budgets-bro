import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';
import * as reportsRepo from '../db/repositories/reportsRepo';
import { COST_BUCKETS } from '../market/costOfLiving';
import type { CostBucket } from '../market/costOfLiving';
import { addMonths } from '../finance-tools/amortization';
import { currentDateISO } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

const MAPPING_KEY = 'cost_bucket_categories';

// Six months, averaged. One month is a bad witness — a quarterly insurance
// bill or a holiday makes it one — and a year reaches back past rent
// increases and moves.
const WINDOW_MONTHS = 6;

export type BucketMapping = Partial<Record<CostBucket, number[]>>;

// Which of the user's own categories count as "groceries" is a question only
// they can answer: a board can name it 食杂, Food, or Costco. The mapping is
// board-wide and lives in app_settings, beside the theme and the lock mode.
export function useBucketSpending() {
  const boardId = useAppStore((s) => s.currentBoardId);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const [mapping, setMapping] = useState<BucketMapping>({});
  const [monthlyByBucket, setMonthlyByBucket] = useState<
    Partial<Record<CostBucket, number>>
  >({});

  useEffect(() => {
    (async () => {
      const db = await getDb();
      setMapping(
        await settingsRepo.getJsonSetting<BucketMapping>(db, MAPPING_KEY, {}),
      );
    })();
  }, [boardId]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const today = currentDateISO();
      const start = addMonths(today, -WINDOW_MONTHS);
      const totals: Partial<Record<CostBucket, number>> = {};
      for (const bucket of COST_BUCKETS) {
        const ids = mapping[bucket] ?? [];
        if (ids.length === 0) continue;
        const spent = await reportsRepo.categorySpendingInRange(
          db,
          boardId,
          ids,
          start,
          today,
        );
        totals[bucket] = Math.round(spent / WINDOW_MONTHS);
      }
      setMonthlyByBucket(totals);
    })();
  }, [mapping, boardId, dataVersion]);

  const setBucketCategories = useCallback(
    async (bucket: CostBucket, categoryIds: number[]) => {
      const next = { ...mapping, [bucket]: categoryIds };
      setMapping(next);
      const db = await getDb();
      await settingsRepo.setJsonSetting(db, MAPPING_KEY, next);
    },
    [mapping],
  );

  const toggleCategory = useCallback(
    (bucket: CostBucket, categoryId: number) => {
      const current = mapping[bucket] ?? [];
      setBucketCategories(
        bucket,
        current.includes(categoryId)
          ? current.filter((id) => id !== categoryId)
          : [...current, categoryId],
      );
    },
    [mapping, setBucketCategories],
  );

  return { mapping, monthlyByBucket, windowMonths: WINDOW_MONTHS, toggleCategory };
}
