import { StyleSheet } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AccountsStackNavigator } from './AccountsStackNavigator';
import { BudgetStackNavigator } from './BudgetStackNavigator';
import { InsightsStackNavigator } from './InsightsStackNavigator';
import { SettingsStackNavigator } from './SettingsStackNavigator';
import { AddTransactionModal } from '../screens/transactions/AddTransactionModal';
import { AccountModal } from '../screens/accounts/AccountModal';
import { TabBarIcon } from '../components/ui/TabBarIcon';
import type { TabIconName } from '../components/ui/TabBarIcon';
import { useBootstrapActiveBoard } from '../hooks/useBoards';
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
  Accounts: 'accounts',
  Insights: 'insights',
  Settings: 'settings',
};

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
        <Tab.Screen name="Accounts" component={AccountsStackNavigator} />
        <Tab.Screen name="Insights" component={InsightsStackNavigator} />
        <Tab.Screen name="Settings" component={SettingsStackNavigator} />
      </Tab.Navigator>
      <AddTransactionModal />
      <AccountModal />
    </NavigationContainer>
  );
}
