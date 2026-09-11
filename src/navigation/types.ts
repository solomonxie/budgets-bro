import type { NavigatorScreenParams } from '@react-navigation/native';

export type BudgetStackParamList = {
  BudgetHome: undefined;
  Transactions: { categoryId?: number; month?: string } | undefined;
  YnabImport: undefined;
};

export type AccountsStackParamList = {
  AccountsList: undefined;
  AccountDetail: { accountId: number };
  ClosedAccounts: undefined;
};

export type InsightsStackParamList = {
  InsightsHome: undefined;
  BabySteps: undefined;
  TaxInsights: undefined;
  Calculators: undefined;
  AiAnalysis: undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
};

export type RootTabParamList = {
  Budget: NavigatorScreenParams<BudgetStackParamList>;
  Accounts: NavigatorScreenParams<AccountsStackParamList>;
  Insights: NavigatorScreenParams<InsightsStackParamList>;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
};
