import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Pressable, Text } from 'react-native';
import { BudgetScreen } from '../screens/budget/BudgetScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { SettingsHeaderButton } from '../components/ui/SettingsHeaderButton';
import { colors } from '../theme/colors';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BudgetStackParamList } from './types';

const Stack = createNativeStackNavigator<BudgetStackParamList>();

function BudgetHeaderRight() {
  const navigation = useNavigation<NativeStackNavigationProp<BudgetStackParamList, 'BudgetHome'>>();
  return (
    <Pressable onPress={() => navigation.navigate('Transactions')}>
      <Text style={{ color: colors.accent, fontWeight: '600' }}>History</Text>
    </Pressable>
  );
}

export function BudgetStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="BudgetHome"
        component={BudgetScreen}
        options={{ title: 'Budget', headerLeft: () => <SettingsHeaderButton />, headerRight: () => <BudgetHeaderRight /> }}
      />
      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
    </Stack.Navigator>
  );
}
