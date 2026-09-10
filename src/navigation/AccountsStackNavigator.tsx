import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountsScreen } from '../screens/accounts/AccountsScreen';
import { AccountDetailScreen } from '../screens/accounts/AccountDetailScreen';
import { SettingsHeaderButton } from '../components/ui/SettingsHeaderButton';
import type { AccountsStackParamList } from './types';

const Stack = createNativeStackNavigator<AccountsStackParamList>();

export function AccountsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AccountsList"
        component={AccountsScreen}
        options={{ title: 'Accounts', headerLeft: () => <SettingsHeaderButton /> }}
      />
      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
