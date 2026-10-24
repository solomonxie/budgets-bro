import type { House, HousePrice } from '../db/repositories/housesRepo';
import { checklistConcerns } from './houseChecklist';

// What tells one listing from another, once the asking price stops being the
// only number on it. Everything here is derived, nothing stored. What it
// would cost to borrow for is the Mortgage page's question, not this one's:
// these are the figures that differ between houses whatever the loan.

export interface HouseMetrics {
  priceCents: number | null;
  /** Dollars per square foot, in cents — the only figure that compares two sizes. */
  pricePerSqftCents: number | null;
  strataMonthlyCents: number;
  taxMonthlyCents: number;
  maintenanceMonthlyCents: number;
  /** Strata, tax and upkeep a month; null when none is known. */
  fixedMonthlyCents: number | null;
  /** Asking against assessed: over 1 means priced above assessment. */
  askingOverAssessed: number | null;
  ageYears: number | null;
  /** Latest asking against the first one on file; null without a change. */
  priceChangeCents: number | null;
  priceChangeRatio: number | null;
  daysOnMarket: number | null;
  /** Checklist items marked as a concern. */
  concerns: number;
  /** Price against its community's latest benchmark; over 1 is above. */
  overBenchmark: number | null;
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

export function houseMetrics(
  house: House,
  {
    todayIso,
    prices = [],
    benchmarkCents = null,
  }: {
    todayIso: string;
    /** This house's asking prices, oldest first. */
    prices?: HousePrice[];
    benchmarkCents?: number | null;
  },
): HouseMetrics {
  const priceCents =
    house.askingPriceCents && house.askingPriceCents > 0
      ? house.askingPriceCents
      : null;
  const strataMonthlyCents = house.strataFeeCents ?? 0;
  const taxMonthlyCents = Math.round((house.propertyTaxAnnualCents ?? 0) / 12);
  const maintenanceMonthlyCents = house.maintenanceMonthlyCents ?? 0;
  const anyFixed =
    house.strataFeeCents != null ||
    house.propertyTaxAnnualCents != null ||
    house.maintenanceMonthlyCents != null;
  const first = prices[0];
  const changed =
    first != null && priceCents != null && first.priceCents !== priceCents;
  const listedOn = house.listedOn ?? first?.date ?? null;
  const thisYear = Number(todayIso.slice(0, 4));

  return {
    priceCents,
    pricePerSqftCents:
      priceCents != null && house.floorAreaSqft && house.floorAreaSqft > 0
        ? Math.round(priceCents / house.floorAreaSqft)
        : null,
    strataMonthlyCents,
    taxMonthlyCents,
    maintenanceMonthlyCents,
    fixedMonthlyCents: anyFixed
      ? strataMonthlyCents + taxMonthlyCents + maintenanceMonthlyCents
      : null,
    askingOverAssessed:
      priceCents != null &&
      house.assessedValueCents &&
      house.assessedValueCents > 0
        ? priceCents / house.assessedValueCents
        : null,
    ageYears: house.yearBuilt ? thisYear - house.yearBuilt : null,
    priceChangeCents: changed ? priceCents! - first!.priceCents : null,
    priceChangeRatio: changed
      ? (priceCents! - first!.priceCents) / first!.priceCents
      : null,
    daysOnMarket: listedOn
      ? Math.max(0, daysBetween(listedOn, todayIso))
      : null,
    concerns: checklistConcerns(house.checklist),
    overBenchmark:
      priceCents != null && benchmarkCents && benchmarkCents > 0
        ? priceCents / benchmarkCents
        : null,
  };
}

/** "400 m", "1.2 km". */
export function formatDistance(metres: number): string {
  return metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toFixed(1)} km`;
}

/** "400", "400 m", "1.2 km", "1,200" → metres; null when blank or unreadable. */
export function parseDistance(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/,/g, '');
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(/km/.test(t) ? n * 1000 : n);
}

export type CompareDirection = 'lowerIsBetter' | 'higherIsBetter' | 'neutral';

export interface CompareRow {
  key: string;
  direction: CompareDirection;
  /** One value per house, in the order given. Null where the house doesn't say. */
  values: (number | null)[];
  /** Index of the best value, or null when nothing is comparable. */
  bestIndex: number | null;
}

/**
 * Marks the best cell per row so a comparison reads at a glance. Ties mark
 * nobody: two identical figures are not a finding, and highlighting both
 * just makes the eye stop for nothing.
 */
export function markBest(
  key: string,
  direction: CompareDirection,
  values: (number | null)[],
): CompareRow {
  if (direction === 'neutral')
    return { key, direction, values, bestIndex: null };
  let bestIndex: number | null = null;
  let bestValue: number | null = null;
  let tied = false;
  values.forEach((value, i) => {
    if (value == null) return;
    if (bestValue == null) {
      bestValue = value;
      bestIndex = i;
      return;
    }
    const better =
      direction === 'lowerIsBetter' ? value < bestValue : value > bestValue;
    if (better) {
      bestValue = value;
      bestIndex = i;
      tied = false;
    } else if (value === bestValue) {
      tied = true;
    }
  });
  return { key, direction, values, bestIndex: tied ? null : bestIndex };
}
