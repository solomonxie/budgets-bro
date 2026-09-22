import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InsightsScreen } from '../screens/insights/InsightsScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { AiAnalysisScreen } from '../screens/ai/AiAnalysisScreen';
import { MortgageInsightsScreen } from '../screens/finance-tools/MortgageInsightsScreen';
import { LoanInsightsScreen } from '../screens/finance-tools/LoanInsightsScreen';
import { InvestmentInsightsScreen } from '../screens/finance-tools/InvestmentInsightsScreen';
import { FinanceToolScreen } from '../screens/finance-tools/FinanceToolScreen';
import { financeTool } from '../screens/finance-tools/registry';
import { BabyStepsScreen } from '../screens/insights/BabyStepsScreen';
import { TaxInsightsScreen } from '../screens/tax/TaxInsightsScreen';
import { PurchaseInsightsScreen } from '../screens/insights/PurchaseInsightsScreen';
import { PayeeInsightsScreen } from '../screens/insights/PayeeInsightsScreen';
import { ExchangeInsightsScreen } from '../screens/insights/ExchangeInsightsScreen';
import { CostOfLivingScreen } from '../screens/insights/CostOfLivingScreen';
import { HousingInsightsScreen } from '../screens/housing/HousingInsightsScreen';
import { HouseDetailScreen } from '../screens/housing/HouseDetailScreen';
import { HouseCompareScreen } from '../screens/housing/HouseCompareScreen';
import { SettingsButton } from '../components/ui/SettingsButton';
import { useT } from '../i18n';
import type { InsightsStackParamList } from './types';

const Stack = createNativeStackNavigator<InsightsStackParamList>();

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
      <Stack.Screen name="BabySteps" component={BabyStepsScreen} options={{ title: t('insights.babySteps') }} />
      <Stack.Screen name="MortgageInsights" component={MortgageInsightsScreen} options={{ title: t('insights.mortgageInsights') }} />
      <Stack.Screen name="LoanInsights" component={LoanInsightsScreen} options={{ title: t('insights.loanInsights') }} />
      <Stack.Screen
        name="InvestmentInsights"
        component={InvestmentInsightsScreen}
        options={{ title: t('insights.investmentInsights') }}
      />
      <Stack.Screen name="TaxInsights" component={TaxInsightsScreen} options={{ title: t('insights.taxInsights') }} />
      <Stack.Screen
        name="PurchaseInsights"
        component={PurchaseInsightsScreen}
        options={{ title: t('insights.purchaseInsights') }}
      />
      <Stack.Screen
        name="PayeeInsights"
        component={PayeeInsightsScreen}
        options={{ title: t('insights.payeeInsights') }}
      />
      <Stack.Screen
        name="ExchangeInsights"
        component={ExchangeInsightsScreen}
        options={{ title: t('insights.exchangeInsights') }}
      />
      <Stack.Screen
        name="CostOfLiving"
        component={CostOfLivingScreen}
        options={{ title: t('insights.costOfLiving') }}
      />
      <Stack.Screen
        name="Housing"
        component={HousingInsightsScreen}
        options={{ title: t('insights.housing') }}
      />
      <Stack.Screen
        name="HouseDetail"
        component={HouseDetailScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="HouseCompare"
        component={HouseCompareScreen}
        options={{ title: t('housing.compareGuideHeading') }}
      />
      <Stack.Screen
        name="FinanceTool"
        component={FinanceToolScreen}
        options={({ route }) => ({ title: t(financeTool(route.params.tool).titleKey) })}
      />
      <Stack.Screen name="AiAnalysis" component={AiAnalysisScreen} options={{ title: t('aiAnalysis.title') }} />
    </Stack.Navigator>
  );
}
