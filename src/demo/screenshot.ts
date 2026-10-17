import { createNavigationContainerRef } from '@react-navigation/native';
import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { LANGUAGE_KEY } from '../hooks/useLanguage';
import { useAppStore } from '../state/useAppStore';
import { enterDemoMode, leaveDemoMode } from './demoMode';

export const screenshotNav = createNavigationContainerRef<any>();

const insights = (screen: string) => () => screenshotNav.navigate('Tabs', { screen: 'Insights', params: { screen } });

const account = (accountId: number) => () =>
  screenshotNav.navigate('Tabs', { screen: 'Accounts', params: { screen: 'AccountDetail', params: { accountId } } });

const ROUTES: Record<string, () => void> = {
  qbr: insights('PaymentReview'),
  prices: insights('TrackedPrices'),
  income: insights('IncomeTrend'),
  house: insights('Housing'),
  loan: account(5),
  budgets: () => screenshotNav.navigate('Tabs', { screen: 'Budget' }),
  spend: () => screenshotNav.navigate('AddTransaction'),
  accounts: () => screenshotNav.navigate('Tabs', { screen: 'Accounts' }),
  chequing: account(1),
  mortgage: insights('MortgageInsights'),
  insights: insights('InsightsHome'),
  payee: insights('PayeeTrend'),
  settings: () => screenshotNav.navigate('Settings'),
  'setup-country': () => screenshotNav.navigate('AccountSetup'),
  'setup-saving': () => screenshotNav.navigate('AccountSetup', { step: 'saving' }),
  'setup-else': () => screenshotNav.navigate('AccountSetup', { step: 'else' }),
  'setup-review': () => screenshotNav.navigate('AccountSetup', { step: 'review' }),
  // Last launch of a screenshot run, so the phone is back on its real data.
  'leave-demo': () => leaveDemoMode().then(() => useAppStore.getState().setDemoModeFlag(false)),
};

// Only reachable when the native side passes `screen` (SCREENSHOTS builds).
export async function prepareScreenshot(lang?: string) {
  await enterDemoMode();
  useAppStore.getState().setDemoModeFlag(true);
  if (lang === 'en' || lang === 'zh') {
    useAppStore.getState().setLanguage(lang);
    await settingsRepo.setSetting(await getDb(), LANGUAGE_KEY, lang);
  }
}

export function openScreenshot(screen: string) {
  setTimeout(() => ROUTES[screen]?.(), 1500);
}
