import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountsScreen } from '../screens/accounts/AccountsScreen';
import { AccountDetailScreen } from '../screens/accounts/AccountDetailScreen';
import { ClosedAccountsScreen } from '../screens/accounts/ClosedAccountsScreen';
import { AmortizationScheduleScreen } from '../screens/accounts/AmortizationScheduleScreen';
import { SettingsButton } from '../components/ui/SettingsButton';
import { useT } from '../i18n';
import type { AccountsStackParamList } from './types';

const Stack = createNativeStackNavigator<AccountsStackParamList>();

export function AccountsStackNavigator() {
  const t = useT();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AccountsList"
        component={AccountsScreen}
        options={{ title: t('nav.accounts'), headerLeft: () => <SettingsButton /> }}
      />
      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="ClosedAccounts" component={ClosedAccountsScreen} options={{ title: t('accounts.closedAccounts') }} />
      <Stack.Screen
        name="AmortizationSchedule"
        component={AmortizationScheduleScreen}
        options={{ title: t('amortizationSchedule.title') }}
      />
    </Stack.Navigator>
  );
}
