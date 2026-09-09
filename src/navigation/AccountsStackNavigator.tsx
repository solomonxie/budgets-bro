import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountsScreen } from '../screens/accounts/AccountsScreen';
import { AccountFormScreen } from '../screens/accounts/AccountFormScreen';
import { AccountDetailScreen } from '../screens/accounts/AccountDetailScreen';
import type { AccountsStackParamList } from './types';

const Stack = createNativeStackNavigator<AccountsStackParamList>();

export function AccountsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AccountsList" component={AccountsScreen} options={{ title: 'Accounts' }} />
      <Stack.Screen name="AccountForm" component={AccountFormScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
