import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AccountsStackNavigator } from './AccountsStackNavigator';
import { BudgetStackNavigator } from './BudgetStackNavigator';
import { ReportsStackNavigator } from './ReportsStackNavigator';
import { SettingsStackNavigator } from './SettingsStackNavigator';
import { ToolsStackNavigator } from './ToolsStackNavigator';
import { AddTransactionModal } from '../screens/transactions/AddTransactionModal';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Budget" component={BudgetStackNavigator} />
        <Tab.Screen name="Accounts" component={AccountsStackNavigator} />
        <Tab.Screen name="Reports" component={ReportsStackNavigator} />
        <Tab.Screen name="Tools" component={ToolsStackNavigator} />
        <Tab.Screen name="Settings" component={SettingsStackNavigator} />
      </Tab.Navigator>
      <AddTransactionModal />
    </NavigationContainer>
  );
}
