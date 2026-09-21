import type { ComponentType } from 'react';
import type { TranslationKey } from '../../i18n';
import { MortgageScreen } from './MortgageScreen';
import { CanadianPurchaseScreen } from './CanadianPurchaseScreen';
import { RequiredIncomeScreen } from './RequiredIncomeScreen';
import { MortgagePayoffScreen, LoanPayoffScreen } from './PayoffScreen';
import { AffordabilityScreen } from './AffordabilityScreen';
import { ChinaPrepaymentScreen } from './ChinaPrepaymentScreen';
import { RefinanceScreen } from './RefinanceScreen';
import { RentVsBuyScreen } from './RentVsBuyScreen';
import { AmortizationScreen } from './AmortizationScreen';
import { AutoLoanScreen } from './AutoLoanScreen';
import { DebtToIncomeScreen } from './DebtToIncomeScreen';
import { InvestmentScreen } from './InvestmentScreen';
import { CompoundInterestScreen } from './CompoundInterestScreen';
import { TaxSavingsScreen } from './TaxSavingsScreen';

export type FinanceToolId =
  | 'canadaPurchase'
  | 'requiredIncome'
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
  { id: 'canadaPurchase', hub: 'mortgage', titleKey: 'calcCanadaPurchase.title', subtitleKey: 'calcCanadaPurchase.subtitle', Screen: CanadianPurchaseScreen },
  { id: 'requiredIncome', hub: 'mortgage', titleKey: 'calcRequiredIncome.title', subtitleKey: 'calcRequiredIncome.subtitle', Screen: RequiredIncomeScreen },
  { id: 'mortgage', hub: 'mortgage', titleKey: 'calcMortgage.title', subtitleKey: 'calcMortgage.subtitle', Screen: MortgageScreen },
  { id: 'mortgagePayoff', hub: 'mortgage', titleKey: 'calcPayoff.title', subtitleKey: 'calcPayoff.subtitle', Screen: MortgagePayoffScreen },
  { id: 'houseAffordability', hub: 'mortgage', titleKey: 'calcAffordability.title', subtitleKey: 'calcAffordability.subtitle', Screen: AffordabilityScreen },
  { id: 'chinaPrepayment', hub: 'mortgage', titleKey: 'calcPrepay.title', subtitleKey: 'calcPrepay.subtitle', Screen: ChinaPrepaymentScreen },
  { id: 'refinance', hub: 'mortgage', titleKey: 'calcRefinance.title', subtitleKey: 'calcRefinance.subtitle', Screen: RefinanceScreen },
  { id: 'rentVsBuy', hub: 'mortgage', titleKey: 'calcRentVsBuy.title', subtitleKey: 'calcRentVsBuy.subtitle', Screen: RentVsBuyScreen },

  { id: 'amortization', hub: 'loan', titleKey: 'calcAmortization.title', subtitleKey: 'calcAmortization.subtitle', Screen: AmortizationScreen },
  { id: 'loanPayoff', hub: 'loan', titleKey: 'calcLoanPayoff.title', subtitleKey: 'calcLoanPayoff.subtitle', Screen: LoanPayoffScreen },
  { id: 'autoLoan', hub: 'loan', titleKey: 'calcAutoLoan.title', subtitleKey: 'calcAutoLoan.subtitle', Screen: AutoLoanScreen },
  { id: 'debtToIncome', hub: 'loan', titleKey: 'calcDti.title', subtitleKey: 'calcDti.subtitle', Screen: DebtToIncomeScreen },

  { id: 'investment', hub: 'invest', titleKey: 'calcInvestment.title', subtitleKey: 'calcInvestment.subtitle', Screen: InvestmentScreen },
  { id: 'compoundInterest', hub: 'invest', titleKey: 'calcCompound.title', subtitleKey: 'calcCompound.subtitle', Screen: CompoundInterestScreen },

  { id: 'taxSavings', hub: 'tax', titleKey: 'calcTaxSavings.title', subtitleKey: 'calcTaxSavings.subtitle', Screen: TaxSavingsScreen },
];

export function financeToolsFor(hub: FinanceToolHub): FinanceToolEntry[] {
  return FINANCE_TOOLS.filter((entry) => entry.hub === hub);
}

export function financeTool(id: FinanceToolId): FinanceToolEntry {
  const entry = FINANCE_TOOLS.find((t) => t.id === id);
  if (!entry) throw new Error(`Unknown finance tool: ${id}`);
  return entry;
}
