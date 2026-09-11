import { StyleSheet } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AccountsStackNavigator } from './AccountsStackNavigator';
import { BudgetStackNavigator } from './BudgetStackNavigator';
import { InsightsStackNavigator } from './InsightsStackNavigator';
import { AddTransactionModal } from '../screens/transactions/AddTransactionModal';
import { AccountModal } from '../screens/accounts/AccountModal';
import { SettingsModal } from '../screens/settings/SettingsModal';
import { TabBarIcon } from '../components/ui/TabBarIcon';
import type { TabIconName } from '../components/ui/TabBarIcon';
import { useBootstrapActiveBoard } from '../hooks/useBoards';
import { useAppStore } from '../state/useAppStore';
import { colors } from '../theme/colors';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

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
  AddTransaction: 'add',
  Accounts: 'accounts',
  Insights: 'insights',
};

// Never actually navigated to — the "AddTransaction" tab's tabPress
// listener (below) intercepts the press and opens the Add Transaction
// sheet instead, same as the floating button it replaces.
function NoopScreen() {
  return null;
}

export function RootNavigator() {
  useBootstrapActiveBoard();
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color }) => (TAB_ICONS[route.name] ? <TabBarIcon name={TAB_ICONS[route.name]} color={color} /> : null),
          tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          // Without an explicit background, iOS renders its own default
          // translucent-blur tab bar — against this app's near-black
          // (but not pure black) theme that blur reads as a stray dark
          // seam right above the tab bar on every screen.
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
        })}
      >
        <Tab.Screen name="Budget" component={BudgetStackNavigator} />
        <Tab.Screen
          name="AddTransaction"
          component={NoopScreen}
          options={{ tabBarLabel: 'Spend' }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              useAppStore.getState().openAddTransaction();
            },
          }}
        />
        <Tab.Screen name="Accounts" component={AccountsStackNavigator} />
        <Tab.Screen name="Insights" component={InsightsStackNavigator} />
      </Tab.Navigator>
      <AddTransactionModal />
      <AccountModal />
      <SettingsModal />
    </NavigationContainer>
  );
}
