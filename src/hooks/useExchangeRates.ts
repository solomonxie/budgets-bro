import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { fetchSeries, fiveYearsAgoISO } from '../market/exchangeRates';
import type { RatePoint } from '../market/exchangeRates';
import { currentDateISO } from '../domain/month';

interface CachedSeries {
  fetchedOn: string;
  points: RatePoint[];
}

function cacheKey(from: string, to: string): string {
  return `fx_series:${from}:${to}`;
}

// Cached in app_settings rather than a table of its own: it is one blob per
// pair, read whole, and it is not the user's data — no migration, and
// nothing for a backup to carry (backups only read board tables).
async function readCache(from: string, to: string): Promise<CachedSeries | null> {
  const db = await getDb();
  return settingsRepo.getJsonSetting<CachedSeries | null>(
    db,
    cacheKey(from, to),
    null,
  );
}

async function writeCache(from: string, to: string, value: CachedSeries): Promise<void> {
  const db = await getDb();
  await settingsRepo.setJsonSetting(db, cacheKey(from, to), value);
}

// One request per pair per day, and never on the way to showing something.
// The cached series renders immediately; the refresh lands whenever it lands.
// The ECB publishes once a working day, so asking more often would only be
// asking the same question again.
export function useExchangeRates(from: string, to: string) {
  const [points, setPoints] = useState<RatePoint[]>([]);
  const [fetchedOn, setFetchedOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force: boolean) => {
      if (from === to) {
        setPoints([]);
        setError(null);
        return;
      }
      const today = currentDateISO();
      const cached = await readCache(from, to);
      if (cached) {
        setPoints(cached.points);
        setFetchedOn(cached.fetchedOn);
        if (!force && cached.fetchedOn === today) return;
      } else {
        setPoints([]);
        setFetchedOn(null);
      }

      setLoading(true);
      setError(null);
      try {
        const fresh = await fetchSeries(from, to, fiveYearsAgoISO(today));
        if (fresh.length > 0) {
          setPoints(fresh);
          setFetchedOn(today);
          await writeCache(from, to, { fetchedOn: today, points: fresh });
        }
      } catch (e) {
        // A failed refresh is not a failed screen: yesterday's rates are
        // still the right shape of answer, so they stay on screen with the
        // date they were fetched.
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [from, to],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return {
    points,
    fetchedOn,
    loading,
    error,
    refresh: () => load(true),
  };
}
