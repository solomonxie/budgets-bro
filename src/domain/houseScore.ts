import type { House } from '../db/repositories/housesRepo';
import type { HouseMetrics } from './houseMetrics';

// Ranking by what matters to you: each criterion is scored 0–1 across the
// houses being looked at (best of them 1, worst 0) and weighted 0–3. A house
// that doesn't say is left out of that criterion rather than marked down.

export const SCORE_CRITERIA = [
  'price',
  'fixedCosts',
  'space',
  'pricePerSqft',
  'age',
  'condition',
  'commute',
  'bus',
  'train',
  'school',
  'grocery',
  'rating',
] as const;

export type ScoreCriterion = (typeof SCORE_CRITERIA)[number];
export type ScoreWeights = Partial<Record<ScoreCriterion, number>>;

export const DEFAULT_WEIGHTS: ScoreWeights = {
  price: 3,
  fixedCosts: 2,
  space: 2,
  condition: 2,
  commute: 1,
  rating: 2,
};

type Read = (house: House, metrics: HouseMetrics) => number | null;

const CRITERIA: Record<ScoreCriterion, { read: Read; lowerIsBetter: boolean }> =
  {
    price: { read: (_h, m) => m.priceCents, lowerIsBetter: true },
    fixedCosts: { read: (_h, m) => m.fixedMonthlyCents, lowerIsBetter: true },
    space: { read: (h) => h.floorAreaSqft, lowerIsBetter: false },
    pricePerSqft: { read: (_h, m) => m.pricePerSqftCents, lowerIsBetter: true },
    age: { read: (_h, m) => m.ageYears, lowerIsBetter: true },
    condition: {
      read: (h, m) => (h.checklist ? m.concerns : null),
      lowerIsBetter: true,
    },
    commute: { read: (h) => h.commuteMinutes, lowerIsBetter: true },
    bus: { read: (h) => h.busDistanceM, lowerIsBetter: true },
    train: { read: (h) => h.trainDistanceM, lowerIsBetter: true },
    school: { read: (h) => h.schoolDistanceM, lowerIsBetter: true },
    grocery: { read: (h) => h.groceryDistanceM, lowerIsBetter: true },
    rating: { read: (h) => h.rating, lowerIsBetter: false },
  };

/** Score 0–100 per house id; null for a house with nothing weighed. */
export function scoreHouses(
  entries: { house: House; metrics: HouseMetrics }[],
  weights: ScoreWeights,
): Map<number, number | null> {
  const totals = new Map<number, { sum: number; weight: number }>();
  for (const criterion of SCORE_CRITERIA) {
    const weight = weights[criterion] ?? 0;
    if (weight <= 0) continue;
    const { read, lowerIsBetter } = CRITERIA[criterion];
    const values = entries.map((e) => read(e.house, e.metrics));
    const known = values.filter((v): v is number => v != null);
    if (known.length === 0) continue;
    const min = Math.min(...known);
    const max = Math.max(...known);
    entries.forEach((e, i) => {
      const v = values[i];
      if (v == null) return;
      const share = max === min ? 1 : (v - min) / (max - min);
      const score = lowerIsBetter ? 1 - share : share;
      const t = totals.get(e.house.id) ?? { sum: 0, weight: 0 };
      totals.set(e.house.id, {
        sum: t.sum + score * weight,
        weight: t.weight + weight,
      });
    });
  }
  return new Map(
    entries.map((e) => {
      const t = totals.get(e.house.id);
      return [
        e.house.id,
        t && t.weight > 0 ? Math.round((t.sum / t.weight) * 100) : null,
      ];
    }),
  );
}
