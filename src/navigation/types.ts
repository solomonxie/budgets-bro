import type { NavigatorScreenParams } from '@react-navigation/native';

// `categoryIds` is the "All Others" case (every category outside Insights'
// top-N breakdown) — plural because Transactions' single-select Category
// dropdown can't represent it, so it's matched separately from
// `categoryId`. Shared by both stacks that push Transactions (Budget's own
// "Details" button, and Insights' category/​"All Others" rows) so back
// navigation returns to wherever the user actually came from instead of
// always landing on Budget.
export type TransactionsFilterParams = { categoryId?: number; categoryIds?: number[]; month?: string } | undefined;

export type BudgetStackParamList = {
  BudgetHome: undefined;
  Transactions: TransactionsFilterParams;
};

export type AccountsStackParamList = {
  AccountsList: undefined;
  AccountDetail: { accountId: number };
  ClosedAccounts: undefined;
};

export type InsightsStackParamList = {
  InsightsHome: undefined;
  Transactions: TransactionsFilterParams;
  BabySteps: undefined;
  TaxInsights: undefined;
  Calculators: undefined;
  AiAnalysis: undefined;
  Upcoming: undefined;
};

export type RootTabParamList = {
  Budget: NavigatorScreenParams<BudgetStackParamList>;
  // Fake tab — its tabPress listener opens the Add Transaction sheet
  // instead of navigating; see RootNavigator's NoopScreen. Settings isn't
  // a tab at all anymore — see SettingsModal, opened from a corner button.
  AddTransaction: undefined;
  Accounts: NavigatorScreenParams<AccountsStackParamList>;
  Insights: NavigatorScreenParams<InsightsStackParamList>;
};
