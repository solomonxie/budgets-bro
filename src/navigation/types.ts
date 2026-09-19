import type { FinanceToolId } from '../screens/finance-tools/registry';
import type { NavigatorScreenParams } from '@react-navigation/native';

// `categoryIds` is the "All Others" case (every category outside Insights'
// top-N breakdown) — plural because Transactions' single-select Category
// dropdown can't represent it, so it's matched separately from
// `categoryId`. Shared by both stacks that push Transactions (Budget's own
// "Details" button, and Insights' category/"All Others" rows) so back
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
  MortgageInsights: undefined;
  LoanInsights: undefined;
  InvestmentInsights: undefined;
  TaxInsights: undefined;
  AiAnalysis: undefined;
  // One route for every calculator — see screens/finance-tools/registry.ts.
  FinanceTool: { tool: FinanceToolId };
};

export type RootTabParamList = {
  Budget: NavigatorScreenParams<BudgetStackParamList>;
  // Fake tab — its tabPress listener pushes the root stack's
  // `AddTransaction` page instead of navigating to a tab; see
  // RootNavigator's NoopScreen. Named apart from that route on purpose: a
  // `navigate('AddTransaction')` from inside the tabs would otherwise
  // resolve to this empty tab. Settings isn't a tab at all anymore — it's a
  // pushed page on the root stack, opened from a corner button.
  SpendTab: undefined;
  Accounts: NavigatorScreenParams<AccountsStackParamList>;
  Insights: NavigatorScreenParams<InsightsStackParamList>;
};

// The tabs sit inside a stack so Add Transaction can be a pushed page —
// a full screen with a back button and the swipe-right-to-go-back gesture,
// rather than a sheet you drag down. Every tab's own stack can reach it:
// `navigate('AddTransaction')` bubbles up to whichever navigator owns the
// route.
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList>;
  AddTransaction: { transactionId?: number; presetAccountId?: number } | undefined;
  // Settings is a page you go to and come back from, not a sheet you
  // dismiss: a route here gives it the native header's back button and the
  // swipe-back gesture, and lets anything it opens push on top of it.
  Settings: undefined;
  // The whole-board cleanup worklist, opened from the history page — every
  // transaction missing a payee or category, duplicated or zero.
  ReviewTransactions: undefined;
};
