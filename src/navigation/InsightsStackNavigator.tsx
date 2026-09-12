import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InsightsScreen } from '../screens/insights/InsightsScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { AiAnalysisScreen } from '../screens/ai/AiAnalysisScreen';
import { StubScreen } from '../components/ui/StubScreen';
import { SettingsButton } from '../components/ui/SettingsButton';
import { useT } from '../i18n';
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
  const t = useT();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="InsightsHome"
        component={InsightsScreen}
        options={{ title: t('nav.insights'), headerLeft: () => <SettingsButton /> }}
      />
      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: t('nav.transactions') }} />
      <Stack.Screen name="BabySteps" options={{ title: t('insights.babySteps') }}>
        {() => <StubScreen title={t('insights.babySteps')} />}
      </Stack.Screen>
      <Stack.Screen name="TaxInsights" options={{ title: t('insights.taxInsights') }}>
        {() => <StubScreen title={t('insights.taxInsights')} />}
      </Stack.Screen>
      <Stack.Screen name="Calculators" options={{ title: t('insights.calculators') }}>
        {() => <StubScreen title={t('insights.calculators')} />}
      </Stack.Screen>
      <Stack.Screen name="AiAnalysis" component={AiAnalysisScreen} options={{ title: t('aiAnalysis.title') }} />
    </Stack.Navigator>
  );
}
