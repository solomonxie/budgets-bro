import { monthlyPaymentCents } from './amortization';
import { bisect } from './solve';

// Lenders cap two ratios: housing cost against gross income (front end) and
// all debt against gross income (back end). 28/36 is the conventional pair.
export interface DtiRule {
  frontEndPercent: number;
  backEndPercent: number;
}

export const CONVENTIONAL_28_36: DtiRule = { frontEndPercent: 28, backEndPercent: 36 };

// Recurring costs of owning, each expressible as a rate on the purchase price
// or a flat annual sum — the two ways people actually know them ("1.5% of
// value" vs "my quote was $1,500").
export interface OwnershipCosts {
  annualRateBps: number;
  termMonths: number;
  downPaymentPercent?: number;
  downPaymentCents?: number;
  propertyTaxAnnualBps?: number;
  propertyTaxAnnualCents?: number;
  insuranceAnnualBps?: number;
  insuranceAnnualCents?: number;
  hoaAnnualBps?: number;
  hoaAnnualCents?: number;
  // Reported, never counted toward DTI — lenders don't ask about upkeep.
  maintenanceAnnualBps?: number;
  closingCostBps?: number;
}

const DEFAULT_MAINTENANCE_BPS = 150; // 1.5%/yr
const DEFAULT_CLOSING_BPS = 300; // 3% of price

export interface MonthlyHousingCost {
  loanCents: number;
  downPaymentCents: number;
  principalInterestCents: number;
  propertyTaxCents: number;
  insuranceCents: number;
  hoaCents: number;
  maintenanceCents: number;
  // What a lender counts: P&I plus escrow and dues, no upkeep.
  dtiHousingCents: number;
  totalMonthlyCents: number;
}

function annualCents(priceCents: number, bps: number | undefined, flatCents: number | undefined): number {
  return Math.round((priceCents * (bps ?? 0)) / 10000) + (flatCents ?? 0);
}

export function monthlyHousingCost(priceCents: number, costs: OwnershipCosts): MonthlyHousingCost {
  const downPaymentCents =
    costs.downPaymentCents != null
      ? Math.min(costs.downPaymentCents, priceCents)
      : Math.round((priceCents * (costs.downPaymentPercent ?? 0)) / 100);
  const loanCents = Math.max(0, priceCents - downPaymentCents);

  const principalInterestCents = monthlyPaymentCents(loanCents, costs.annualRateBps, costs.termMonths);
  const propertyTaxCents = Math.round(annualCents(priceCents, costs.propertyTaxAnnualBps, costs.propertyTaxAnnualCents) / 12);
  const insuranceCents = Math.round(annualCents(priceCents, costs.insuranceAnnualBps, costs.insuranceAnnualCents) / 12);
  const hoaCents = Math.round(annualCents(priceCents, costs.hoaAnnualBps, costs.hoaAnnualCents) / 12);
  const maintenanceCents = Math.round(annualCents(priceCents, costs.maintenanceAnnualBps ?? DEFAULT_MAINTENANCE_BPS, undefined) / 12);

  const dtiHousingCents = principalInterestCents + propertyTaxCents + insuranceCents + hoaCents;
  return {
    loanCents,
    downPaymentCents,
    principalInterestCents,
    propertyTaxCents,
    insuranceCents,
    hoaCents,
    maintenanceCents,
    dtiHousingCents,
    totalMonthlyCents: dtiHousingCents + maintenanceCents,
  };
}

export interface AffordabilityResult extends MonthlyHousingCost {
  maxHousePriceCents: number;
  closingCostCents: number;
  totalAtClosingCents: number;
  frontEndPercent: number;
  backEndPercent: number;
}

const MAX_SEARCH_PRICE_CENTS = 10_000_000_000_00; // $10bn — far past any real search

// Price is circular: property tax and insurance are percentages of the very
// number being solved for. Housing cost rises monotonically with price, so
// bisection settles it without any algebra that would break the moment a cost
// switches from a rate to a flat sum.
function priceWhereHousingCostIs(targetMonthlyCents: number, costs: OwnershipCosts, includeMaintenance: boolean): number {
  if (targetMonthlyCents <= 0) return 0;
  const costAt = (price: number) => {
    const c = monthlyHousingCost(price, costs);
    return includeMaintenance ? c.totalMonthlyCents : c.dtiHousingCents;
  };
  return Math.round(bisect((price) => costAt(price) - targetMonthlyCents, 0, MAX_SEARCH_PRICE_CENTS, 1));
}

function finish(priceCents: number, costs: OwnershipCosts, monthlyIncomeCents: number, monthlyDebtCents: number): AffordabilityResult {
  const cost = monthlyHousingCost(priceCents, costs);
  const closingCostCents = Math.round((priceCents * (costs.closingCostBps ?? DEFAULT_CLOSING_BPS)) / 10000);
  const ratios = dtiRatios({ monthlyIncomeCents, housingCents: cost.dtiHousingCents, otherDebtCents: monthlyDebtCents });
  return {
    ...cost,
    maxHousePriceCents: priceCents,
    closingCostCents,
    totalAtClosingCents: cost.downPaymentCents + closingCostCents,
    ...ratios,
  };
}

export interface AffordabilityInput {
  annualIncomeCents: number;
  monthlyDebtCents: number;
  rule: DtiRule;
  costs: OwnershipCosts;
}

export function maxAffordablePrice({ annualIncomeCents, monthlyDebtCents, rule, costs }: AffordabilityInput): AffordabilityResult {
  const monthlyIncomeCents = Math.round(annualIncomeCents / 12);
  const frontCapCents = Math.round((monthlyIncomeCents * rule.frontEndPercent) / 100);
  // The back-end cap is what's left of the all-debt allowance after existing
  // payments — which is why a car loan costs you house.
  const backCapCents = Math.round((monthlyIncomeCents * rule.backEndPercent) / 100) - monthlyDebtCents;
  const capCents = Math.max(0, Math.min(frontCapCents, backCapCents));
  return finish(priceWhereHousingCostIs(capCents, costs, false), costs, monthlyIncomeCents, monthlyDebtCents);
}

// The other way people ask it: not "what will a lender allow" but "I can spend
// this much a month". `includeMaintenance` decides whether upkeep comes out of
// that budget or sits on top of it.
export function maxPriceFromMonthlyBudget(
  monthlyBudgetCents: number,
  costs: OwnershipCosts,
  includeMaintenance = true,
): AffordabilityResult {
  return finish(priceWhereHousingCostIs(monthlyBudgetCents, costs, includeMaintenance), costs, 0, 0);
}

export function dtiRatios({
  monthlyIncomeCents,
  housingCents,
  otherDebtCents,
}: {
  monthlyIncomeCents: number;
  housingCents: number;
  otherDebtCents: number;
}): { frontEndPercent: number; backEndPercent: number } {
  if (monthlyIncomeCents <= 0) return { frontEndPercent: 0, backEndPercent: 0 };
  return {
    frontEndPercent: (housingCents / monthlyIncomeCents) * 100,
    backEndPercent: ((housingCents + otherDebtCents) / monthlyIncomeCents) * 100,
  };
}
