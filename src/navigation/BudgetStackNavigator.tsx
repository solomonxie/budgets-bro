import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BudgetScreen } from '../screens/budget/BudgetScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { SettingsButton } from '../components/ui/SettingsButton';
import { useT } from '../i18n';
import { colors } from '../theme/colors';
import type { BudgetStackParamList } from './types';

const Stack = createNativeStackNavigator<BudgetStackParamList>();

export function BudgetStackNavigator() {
  const t = useT();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="BudgetHome"
        component={BudgetScreen}
        options={({ navigation }) => ({
          title: t('nav.budget'),
          headerLeft: () => <SettingsButton />,
          // A native bar button: a React view in headerRight misses its
          // first tap after a cold start.
          unstable_headerRightItems: () => [
            {
              type: 'button',
              label: t('nav.history'),
              tintColor: colors.accent,
              labelStyle: { fontWeight: '600' },
              onPress: () => navigation.navigate('Transactions'),
            },
          ],
        })}
      />
      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: t('nav.transactions') }} />
    </Stack.Navigator>
  );
}
