import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InsightsScreen } from '../screens/insights/InsightsScreen';
import { BabyStepsScreen } from '../screens/insights/BabyStepsScreen';
import { CalculatorsHomeScreen } from '../screens/calculators/CalculatorsHomeScreen';
import { AiAnalysisScreen } from '../screens/ai/AiAnalysisScreen';
import { TaxInsightsScreen } from '../screens/tax/TaxInsightsScreen';
import type { InsightsStackParamList } from './types';

const Stack = createNativeStackNavigator<InsightsStackParamList>();

export function InsightsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="InsightsHome" component={InsightsScreen} options={{ title: 'Insights' }} />
      <Stack.Screen name="BabySteps" component={BabyStepsScreen} options={{ title: 'Baby Steps' }} />
      <Stack.Screen name="TaxInsights" component={TaxInsightsScreen} options={{ title: 'Tax Insights' }} />
      <Stack.Screen name="Calculators" component={CalculatorsHomeScreen} options={{ title: 'Calculators' }} />
      <Stack.Screen name="AiAnalysis" component={AiAnalysisScreen} options={{ title: 'AI Analysis' }} />
    </Stack.Navigator>
  );
}
