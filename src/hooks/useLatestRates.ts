import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { fetchLatest } from '../market/exchangeRates';
import { currentDateISO } from '../domain/month';

// Quoted against the euro, which is what the ECB publishes: every other pair
// is a division away, so one table answers every currency on the page and
// the one the user adds next.
const BASE = 'EUR';
const CACHE_KEY = `fx_latest:${BASE}`;

interface CachedTable {
  fetchedOn: string;
  rates: Record<string, number>;
}

// One request a day, after the page is already on screen. The cached table
// renders immediately — an offline converter with yesterday's rates is the
// right shape of answer, and it says which day it is quoting.
export function useLatestRates() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [fetchedOn, setFetchedOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    const today = currentDateISO();
    const db = await getDb();
    const cached = await settingsRepo.getJsonSetting<CachedTable | null>(
      db,
      CACHE_KEY,
      null,
    );
    if (cached) {
      setRates(cached.rates);
      setFetchedOn(cached.fetchedOn);
      if (!force && cached.fetchedOn === today) return;
    }

    setLoading(true);
    setError(null);
    try {
      const fresh = await fetchLatest(BASE);
      setRates(fresh.rates);
      setFetchedOn(today);
      await settingsRepo.setJsonSetting(db, CACHE_KEY, {
        fetchedOn: today,
        rates: fresh.rates,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return {
    rates,
    fetchedOn,
    loading,
    error,
    refresh: () => load(true),
  };
}
