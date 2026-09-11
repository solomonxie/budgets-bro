import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InsightsScreen } from '../screens/insights/InsightsScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { AiAnalysisScreen } from '../screens/ai/AiAnalysisScreen';
import { StubScreen } from '../components/ui/StubScreen';
import { SettingsButton } from '../components/ui/SettingsButton';
import type { InsightsStackParamList } from './types';

const Stack = createNativeStackNavigator<InsightsStackParamList>();

// Baby Steps, Tax Insights, and Calculators are stubbed to "coming soon"
// until redesigned — swap these back to their real screen components
// (screens/insights/BabyStepsScreen, screens/tax/TaxInsightsScreen,
// screens/calculators/CalculatorsHomeScreen) when ready.
//
// Transactions is pushed locally here too (same screen component as
// Budget's) instead of cross-tab-navigating into Budget's stack — so
// tapping a category/"All Others" row and then going back lands on
// Insights, not on Budget's home.
export function InsightsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="InsightsHome"
        component={InsightsScreen}
        options={{ title: 'Insights', headerLeft: () => <SettingsButton /> }}
      />
      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
      <Stack.Screen name="BabySteps" options={{ title: 'Baby Steps' }}>
        {() => <StubScreen title="Baby Steps" />}
      </Stack.Screen>
      <Stack.Screen name="TaxInsights" options={{ title: 'Tax Insights' }}>
        {() => <StubScreen title="Tax Insights" />}
      </Stack.Screen>
      <Stack.Screen name="Calculators" options={{ title: 'Calculators' }}>
        {() => <StubScreen title="Calculators" />}
      </Stack.Screen>
      <Stack.Screen name="AiAnalysis" component={AiAnalysisScreen} options={{ title: 'AI Analysis' }} />
    </Stack.Navigator>
  );
}
