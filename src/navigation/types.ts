import type { NavigatorScreenParams } from '@react-navigation/native';

export type BudgetStackParamList = {
  BudgetHome: undefined;
  Transactions: undefined;
};

export type AccountsStackParamList = {
  AccountsList: undefined;
  AccountForm: { accountId?: number } | undefined;
  AccountDetail: { accountId: number };
};

export type ReportsStackParamList = {
  ReportsHome: undefined;
};

export type ToolsStackParamList = {
  ToolsHome: undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  ManageCategories: undefined;
  CategoryForm: { categoryId?: number; groupId?: number } | undefined;
};

export type RootTabParamList = {
  Budget: NavigatorScreenParams<BudgetStackParamList>;
  Accounts: NavigatorScreenParams<AccountsStackParamList>;
  Reports: NavigatorScreenParams<ReportsStackParamList>;
  Tools: NavigatorScreenParams<ToolsStackParamList>;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
};
