import { StyleSheet } from 'react-native';
import {
  DarkTheme,
  NavigationContainer,
  useNavigation,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AccountsStackNavigator } from './AccountsStackNavigator';
import { BudgetStackNavigator } from './BudgetStackNavigator';
import { InsightsStackNavigator } from './InsightsStackNavigator';
import { AddTransactionScreen } from '../screens/transactions/AddTransactionScreen';
import { AccountModal } from '../screens/accounts/AccountModal';
import { SettingsModal } from '../screens/settings/SettingsModal';
import { TabBarIcon } from '../components/ui/TabBarIcon';
import { focusedAccountId } from './focusedAccount';
import type { TabNavState } from './focusedAccount';
import type { TabIconName } from '../components/ui/TabBarIcon';
import {
  useBootstrapActiveBoard,
  useEnsureDemoBoard,
} from '../hooks/useBoards';
import { useBootstrapLanguage } from '../hooks/useLanguage';
import { useAutoCloudSync } from '../hooks/useCloudSync';
import { useT } from '../i18n';
import { colors } from '../theme/colors';
import type { RootStackParamList, RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

type RootNav = NativeStackNavigationProp<RootStackParamList>;

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

const TAB_ICONS: Record<string, TabIconName> = {
  Budget: 'budget',
  SpendTab: 'add',
  Accounts: 'accounts',
  Insights: 'insights',
};

// Never actually navigated to — the Spend tab's tabPress listener (below)
// intercepts the press and pushes the Add Transaction page instead, same as
// the floating button it replaces.
function NoopScreen() {
  return null;
}

function Tabs() {
  const t = useT();
  // Tabs is itself a screen of the root stack, so this is that stack's
  // navigation — what the Spend tab needs to push Add Transaction over the
  // whole tab bar.
  const rootNavigation = useNavigation<RootNav>();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color }) =>
          TAB_ICONS[route.name] ? (
            <TabBarIcon name={TAB_ICONS[route.name]} color={color} />
          ) : null,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        // Without an explicit background, iOS renders its own default
        // translucent-blur tab bar — against this app's near-black
        // (but not pure black) theme that blur reads as a stray dark
        // seam right above the tab bar on every screen.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      })}
    >
      <Tab.Screen
        name="Budget"
        component={BudgetStackNavigator}
        options={{ tabBarLabel: t('nav.budget') }}
      />
      <Tab.Screen
        name="SpendTab"
        component={NoopScreen}
        options={{ tabBarLabel: t('nav.spend') }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            const presetAccountId = focusedAccountId(
              navigation.getState() as unknown as TabNavState,
            );
            rootNavigation.navigate(
              'AddTransaction',
              presetAccountId != null ? { presetAccountId } : undefined,
            );
          },
        })}
      />
      <Tab.Screen
        name="Accounts"
        component={AccountsStackNavigator}
        options={{ tabBarLabel: t('nav.accounts') }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsStackNavigator}
        options={{ tabBarLabel: t('nav.insights') }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  useBootstrapActiveBoard();
  useEnsureDemoBoard();
  useBootstrapLanguage();
  useAutoCloudSync();
  const t = useT();
  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator>
        <RootStack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="AddTransaction"
          component={AddTransactionScreen}
          // fullScreenGestureEnabled: the swipe back works from anywhere on
          // the page, not just the left edge — this page is a form, and
          // hunting for the edge to get out of it is the thing the sheet's
          // pull-down was replaced for.
          options={({ route }) => ({
            title: t(
              route.params?.transactionId != null
                ? 'spend.editTitle'
                : 'spend.addTitle',
            ),
            // The plain word: 'common.back' carries its own ‹ for in-page
            // buttons, and the native header already draws one.
            headerBackTitle: t('common.backTitle'),
            fullScreenGestureEnabled: true,
          })}
        />
      </RootStack.Navigator>
      <AccountModal />
      <SettingsModal />
    </NavigationContainer>
  );
}
