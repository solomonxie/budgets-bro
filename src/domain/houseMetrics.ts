import { minimumDownPaymentCents, mortgageInsurance, paymentPlan } from '../finance-tools/canadianMortgage';
import type { House } from '../db/repositories/housesRepo';

// What a listing actually means, once the asking price stops being the only
// number on it. Everything here is derived — nothing is stored — so
// correcting a rate or a down payment moves every house at once.

export interface HouseAssumptions {
  annualRateBps: number;
  amortizationMonths: number;
  /** Null means "the legal minimum for this price", which is the honest default. */
  downPaymentPercent: number | null;
  /** Monthly, on top of strata and tax: heat, power, water, insurance. */
  utilitiesMonthlyCents: number;
}

export const DEFAULT_ASSUMPTIONS: HouseAssumptions = {
  annualRateBps: 450,
  amortizationMonths: 300,
  downPaymentPercent: 20,
  utilitiesMonthlyCents: 25_000,
};

export interface HouseMetrics {
  priceCents: number | null;
  /** Dollars per square foot, in cents — the only figure that compares two sizes. */
  pricePerSqftCents: number | null;
  downPaymentCents: number | null;
  mortgageCents: number | null;
  insurancePremiumCents: number;
  paymentMonthlyCents: number | null;
  strataMonthlyCents: number;
  taxMonthlyCents: number;
  utilitiesMonthlyCents: number;
  /** Everything it costs to hold, per month. */
  carryingMonthlyCents: number | null;
  /** Asking against assessed: over 1 means priced above assessment. */
  askingOverAssessed: number | null;
  ageYears: number | null;
}

export function houseMetrics(
  house: House,
  assumptions: HouseAssumptions,
  thisYear: number,
): HouseMetrics {
  const priceCents = house.askingPriceCents;
  const strataMonthlyCents = house.strataFeeCents ?? 0;
  const taxMonthlyCents = Math.round((house.propertyTaxAnnualCents ?? 0) / 12);
  const utilitiesMonthlyCents = assumptions.utilitiesMonthlyCents;

  if (!priceCents || priceCents <= 0) {
    return {
      priceCents: null,
      pricePerSqftCents: null,
      downPaymentCents: null,
      mortgageCents: null,
      insurancePremiumCents: 0,
      paymentMonthlyCents: null,
      strataMonthlyCents,
      taxMonthlyCents,
      utilitiesMonthlyCents,
      carryingMonthlyCents: null,
      askingOverAssessed: null,
      ageYears: house.yearBuilt ? thisYear - house.yearBuilt : null,
    };
  }

  const downPaymentCents =
    assumptions.downPaymentPercent == null
      ? minimumDownPaymentCents(priceCents)
      : Math.round((priceCents * assumptions.downPaymentPercent) / 100);
  const insurance = mortgageInsurance(
    priceCents,
    downPaymentCents,
    assumptions.amortizationMonths,
  );
  const plan = paymentPlan(
    insurance.totalMortgageCents,
    assumptions.annualRateBps,
    assumptions.amortizationMonths,
  );

  return {
    priceCents,
    pricePerSqftCents:
      house.floorAreaSqft && house.floorAreaSqft > 0
        ? Math.round(priceCents / house.floorAreaSqft)
        : null,
    downPaymentCents,
    mortgageCents: insurance.totalMortgageCents,
    insurancePremiumCents: insurance.premiumCents,
    paymentMonthlyCents: plan.paymentCents,
    strataMonthlyCents,
    taxMonthlyCents,
    utilitiesMonthlyCents,
    carryingMonthlyCents:
      plan.paymentCents + strataMonthlyCents + taxMonthlyCents + utilitiesMonthlyCents,
    askingOverAssessed:
      house.assessedValueCents && house.assessedValueCents > 0
        ? priceCents / house.assessedValueCents
        : null,
    ageYears: house.yearBuilt ? thisYear - house.yearBuilt : null,
  };
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
  if (direction === 'neutral') return { key, direction, values, bestIndex: null };
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
