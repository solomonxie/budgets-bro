import type { NavigatorScreenParams } from '@react-navigation/native';

export type BudgetStackParamList = {
  BudgetHome: undefined;
  Transactions: undefined;
};

export type AccountsStackParamList = {
  AccountsList: undefined;
  AccountDetail: { accountId: number };
};

export type InsightsStackParamList = {
  InsightsHome: undefined;
  BabySteps: undefined;
  TaxInsights: undefined;
  Calculators: undefined;
  AiAnalysis: undefined;
  YnabImport: undefined;
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
