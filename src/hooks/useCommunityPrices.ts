import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as communityPricesRepo from '../db/repositories/communityPricesRepo';
import type {
  CommunityPrice,
  CommunityPriceInput,
} from '../db/repositories/communityPricesRepo';
import { useAppStore } from '../state/useAppStore';

export interface CommunitySeries {
  key: string;
  city: string;
  community: string;
  points: CommunityPrice[];
}

// Grouped by city and community here rather than in SQL: the whole log is a
// handful of rows anyone would type by hand, and the screen wants it grouped
// two different ways.
export function useCommunityPrices() {
  const boardId = useAppStore((s) => s.currentBoardId);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [prices, setPrices] = useState<CommunityPrice[]>([]);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setPrices(await communityPricesRepo.listPrices(db, boardId));
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const add = useCallback(
    async (input: CommunityPriceInput) => {
      const db = await getDb();
      await communityPricesRepo.addPrice(db, boardId, input);
      bumpDataVersion();
    },
    [boardId, bumpDataVersion],
  );

  const remove = useCallback(
    async (id: number) => {
      const db = await getDb();
      await communityPricesRepo.deletePrice(db, id);
      bumpDataVersion();
    },
    [bumpDataVersion],
  );

  const series: CommunitySeries[] = [];
  for (const price of prices) {
    const key = `${price.city}|${price.community}`;
    let entry = series.find((s) => s.key === key);
    if (!entry) {
      entry = { key, city: price.city, community: price.community, points: [] };
      series.push(entry);
    }
    entry.points.push(price);
  }

  return { prices, series, add, remove };
}
