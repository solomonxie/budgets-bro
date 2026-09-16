import type { ComponentType } from 'react';
import type { TranslationKey } from '../../i18n';

export type FinanceToolId =
  | 'mortgage'
  | 'mortgagePayoff'
  | 'houseAffordability'
  | 'chinaPrepayment'
  | 'refinance'
  | 'rentVsBuy'
  | 'amortization'
  | 'autoLoan'
  | 'debtToIncome'
  | 'loanPayoff'
  | 'investment'
  | 'compoundInterest'
  | 'taxSavings';

export type FinanceToolHub = 'mortgage' | 'loan' | 'invest' | 'tax';

export interface FinanceToolEntry {
  id: FinanceToolId;
  hub: FinanceToolHub;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  // null until the tool is built — FinanceToolScreen falls back to StubScreen,
  // so an unbuilt tool is still listed and still says what it will do.
  Screen: ComponentType | null;
}

// Single source of truth for both the router and the hub lists: adding a tool
// is one entry here, shipping it is swapping `Screen` off null.
export const FINANCE_TOOLS: FinanceToolEntry[] = [
  { id: 'mortgage', hub: 'mortgage', titleKey: 'calcMortgage.title', subtitleKey: 'calcMortgage.subtitle', Screen: null },
  { id: 'mortgagePayoff', hub: 'mortgage', titleKey: 'calcPayoff.title', subtitleKey: 'calcPayoff.subtitle', Screen: null },
  { id: 'houseAffordability', hub: 'mortgage', titleKey: 'calcAffordability.title', subtitleKey: 'calcAffordability.subtitle', Screen: null },
  { id: 'chinaPrepayment', hub: 'mortgage', titleKey: 'calcPrepay.title', subtitleKey: 'calcPrepay.subtitle', Screen: null },
  { id: 'refinance', hub: 'mortgage', titleKey: 'calcRefinance.title', subtitleKey: 'calcRefinance.subtitle', Screen: null },
  { id: 'rentVsBuy', hub: 'mortgage', titleKey: 'calcRentVsBuy.title', subtitleKey: 'calcRentVsBuy.subtitle', Screen: null },

  { id: 'amortization', hub: 'loan', titleKey: 'calcAmortization.title', subtitleKey: 'calcAmortization.subtitle', Screen: null },
  { id: 'loanPayoff', hub: 'loan', titleKey: 'calcLoanPayoff.title', subtitleKey: 'calcLoanPayoff.subtitle', Screen: null },
  { id: 'autoLoan', hub: 'loan', titleKey: 'calcAutoLoan.title', subtitleKey: 'calcAutoLoan.subtitle', Screen: null },
  { id: 'debtToIncome', hub: 'loan', titleKey: 'calcDti.title', subtitleKey: 'calcDti.subtitle', Screen: null },

  { id: 'investment', hub: 'invest', titleKey: 'calcInvestment.title', subtitleKey: 'calcInvestment.subtitle', Screen: null },
  { id: 'compoundInterest', hub: 'invest', titleKey: 'calcCompound.title', subtitleKey: 'calcCompound.subtitle', Screen: null },

  { id: 'taxSavings', hub: 'tax', titleKey: 'calcTaxSavings.title', subtitleKey: 'calcTaxSavings.subtitle', Screen: null },
];

export function financeToolsFor(hub: FinanceToolHub): FinanceToolEntry[] {
  return FINANCE_TOOLS.filter((entry) => entry.hub === hub);
}

export function financeTool(id: FinanceToolId): FinanceToolEntry {
  const entry = FINANCE_TOOLS.find((t) => t.id === id);
  if (!entry) throw new Error(`Unknown finance tool: ${id}`);
  return entry;
}
