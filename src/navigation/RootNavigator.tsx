import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AccountsStackNavigator } from './AccountsStackNavigator';
import { BudgetStackNavigator } from './BudgetStackNavigator';
import { InsightsStackNavigator } from './InsightsStackNavigator';
import { SettingsStackNavigator } from './SettingsStackNavigator';
import { AddTransactionModal } from '../screens/transactions/AddTransactionModal';
import { AccountModal } from '../screens/accounts/AccountModal';
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

export function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator screenOptions={{ headerShown: false, tabBarIcon: () => null }}>
        <Tab.Screen name="Budget" component={BudgetStackNavigator} />
        <Tab.Screen name="Accounts" component={AccountsStackNavigator} />
        <Tab.Screen name="Insights" component={InsightsStackNavigator} />
        {/* Reachable only via the top-left "Settings" header button, not the tab bar. */}
        <Tab.Screen name="Settings" component={SettingsStackNavigator} options={{ tabBarButton: () => null }} />
      </Tab.Navigator>
      <AddTransactionModal />
      <AccountModal />
    </NavigationContainer>
  );
}
