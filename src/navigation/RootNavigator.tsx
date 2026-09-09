import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AccountsScreen } from '../screens/accounts/AccountsScreen';
import { AiAnalysisScreen } from '../screens/ai/AiAnalysisScreen';
import { BudgetScreen } from '../screens/budget/BudgetScreen';
import { CalculatorsHomeScreen } from '../screens/calculators/CalculatorsHomeScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Budget" component={BudgetScreen} />
        <Tab.Screen name="Accounts" component={AccountsScreen} />
        <Tab.Screen name="Calculators" component={CalculatorsHomeScreen} />
        <Tab.Screen name="AiAnalysis" component={AiAnalysisScreen} options={{ title: 'AI' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
