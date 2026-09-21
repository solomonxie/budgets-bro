import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { listAiKeys, runWithAiKeys, aiVendorName } from '../ai/aiKeys';
import { cityById, COST_OF_LIVING_AS_OF } from '../market/costOfLiving';
import type { CityCostsUpdate, CostBucket } from '../market/costOfLiving';
import { cityCostPrompt, parseCityCostReply } from '../market/cityCostPrompt';
import { currentDateISO } from '../domain/month';

function cacheKey(cityId: string): string {
  return `city_costs:${cityId}`;
}

// Two figure sets per city: the one that shipped, and — if the user asked
// an AI for a newer read — whatever it said, kept separately so the shipped
// table is never silently overwritten and either can be shown.
export function useCityCosts(cityId: string, cityName: string) {
  const [update, setUpdate] = useState<CityCostsUpdate | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAiKey, setHasAiKey] = useState(false);

  const preset = cityById(cityId);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      setHasAiKey((await listAiKeys(db)).length > 0);
      setUpdate(
        await settingsRepo.getJsonSetting<CityCostsUpdate | null>(
          db,
          cacheKey(cityId),
          null,
        ),
      );
      setError(null);
    })();
  }, [cityId]);

  const askAi = useCallback(async () => {
    if (!preset) return;
    setAsking(true);
    setError(null);
    try {
      const db = await getDb();
      const keys = await listAiKeys(db);
      const reply = await runWithAiKeys(db, [
        { role: 'user', content: cityCostPrompt(cityName, preset.currency) },
      ]);
      const parsed = parseCityCostReply(reply);
      if (!parsed) throw new Error('unparsable');
      const merged = { ...preset.monthly } as Record<CostBucket, number>;
      for (const [bucket, cents] of Object.entries(parsed)) {
        merged[bucket as CostBucket] = cents;
      }
      const next: CityCostsUpdate = {
        cityId,
        currency: preset.currency,
        monthly: merged,
        model: keys[0] ? aiVendorName(keys[0].vendor) : 'AI',
        askedOn: currentDateISO(),
      };
      await settingsRepo.setJsonSetting(db, cacheKey(cityId), next);
      setUpdate(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  }, [cityId, cityName, preset]);

  const clearUpdate = useCallback(async () => {
    const db = await getDb();
    await settingsRepo.setJsonSetting(db, cacheKey(cityId), null);
    setUpdate(null);
  }, [cityId]);

  return {
    preset,
    update,
    monthly: update?.monthly ?? preset?.monthly ?? null,
    currency: preset?.currency ?? 'CAD',
    asOf: update ? update.askedOn : COST_OF_LIVING_AS_OF,
    fromAi: update != null,
    model: update?.model ?? null,
    hasAiKey,
    asking,
    error,
    askAi,
    clearUpdate,
  };
}
