import { cityById, COST_OF_LIVING_AS_OF } from '../market/costOfLiving';

// A city's shipped cost-of-living table.
export function useCityCosts(cityId: string) {
  const preset = cityById(cityId);
  return {
    preset,
    monthly: preset?.monthly ?? null,
    currency: preset?.currency ?? 'CAD',
    asOf: COST_OF_LIVING_AS_OF,
  };
}
