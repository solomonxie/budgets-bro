import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, Text } from 'react-native';
import { BudgetScreen } from '../screens/budget/BudgetScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { colors } from '../theme/colors';
import type { BudgetStackParamList } from './types';

const Stack = createNativeStackNavigator<BudgetStackParamList>();

export function BudgetStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="BudgetHome"
        component={BudgetScreen}
        options={({ navigation }) => ({
          title: 'Budget',
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('Transactions')}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>All</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
    </Stack.Navigator>
  );
}
