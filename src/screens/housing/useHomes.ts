import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDb } from '../../db/client';
import * as housesRepo from '../../db/repositories/housesRepo';
import { ARCHIVED_STATUSES } from '../../db/repositories/housesRepo';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import type { House, HousePrice } from '../../db/repositories/housesRepo';
import type { CommunityPrice } from '../../db/repositories/communityPricesRepo';
import { useHouses } from '../../hooks/useHouses';
import { useCommunityPrices } from '../../hooks/useCommunityPrices';
import { houseMetrics } from '../../domain/houseMetrics';
import type { HouseMetrics } from '../../domain/houseMetrics';
import { DEFAULT_WEIGHTS, scoreHouses } from '../../domain/houseScore';
import type { ScoreWeights } from '../../domain/houseScore';
import { currentDateISO } from '../../domain/month';
import { useAppStore } from '../../state/useAppStore';

const WEIGHTS_KEY = 'homes_score_weights';

// The latest benchmark for a house's own community (and city, when both
// say one), preferring one for the same property type.
export function benchmarkFor(
  house: House,
  prices: CommunityPrice[],
): CommunityPrice | null {
  if (!house.community) return null;
  const same = (a: string | null, b: string | null) =>
    (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
  const matches = prices.filter(
    (p) =>
      same(p.community, house.community) &&
      (!house.city || !p.city || same(p.city, house.city)),
  );
  const typed = matches.filter(
    (p) => house.propertyType && same(p.propertyType, house.propertyType),
  );
  const pool = typed.length > 0 ? typed : matches;
  return pool.reduce<CommunityPrice | null>(
    (latest, p) => (!latest || p.asOfMonth > latest.asOfMonth ? p : latest),
    null,
  );
}

export interface HomeEntry {
  house: House;
  metrics: HouseMetrics;
  prices: HousePrice[];
  benchmark: CommunityPrice | null;
  score: number | null;
}

// Every house with its figures, price history, benchmark and score — the one
// reading the list, a house and the comparison all share, so they agree.
export function useHomes() {
  const housesApi = useHouses();
  const { houses } = housesApi;
  const communities = useCommunityPrices();
  const boardId = useAppStore((s) => s.currentBoardId);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const [prices, setPrices] = useState<HousePrice[]>([]);
  const [weights, setWeightsState] = useState<ScoreWeights>(DEFAULT_WEIGHTS);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      setPrices(await housesRepo.listHousePrices(db, boardId));
      setWeightsState(
        await settingsRepo.getJsonSetting(db, WEIGHTS_KEY, DEFAULT_WEIGHTS),
      );
    })();
  }, [boardId, dataVersion]);

  const setWeights = useCallback(async (next: ScoreWeights) => {
    setWeightsState(next);
    await settingsRepo.setJsonSetting(await getDb(), WEIGHTS_KEY, next);
  }, []);

  const entries = useMemo<HomeEntry[]>(() => {
    const today = currentDateISO();
    const base = houses.map((house) => {
      const own = prices.filter((p) => p.houseId === house.id);
      const benchmark = benchmarkFor(house, communities.prices);
      return {
        house,
        prices: own,
        benchmark,
        metrics: houseMetrics(house, {
          todayIso: today,
          prices: own,
          benchmarkCents: benchmark?.benchmarkPriceCents ?? null,
        }),
      };
    });
    // Ranked among the houses still in the running.
    const scores = scoreHouses(
      base.filter((e) => !ARCHIVED_STATUSES.includes(e.house.status)),
      weights,
    );
    return base.map((e) => ({ ...e, score: scores.get(e.house.id) ?? null }));
  }, [houses, prices, communities.prices, weights]);

  return { ...housesApi, entries, weights, setWeights, communities };
}
