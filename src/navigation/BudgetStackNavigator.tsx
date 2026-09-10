import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Pressable, Text, View } from 'react-native';
import { BudgetScreen } from '../screens/budget/BudgetScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { CategoriesScreen } from '../screens/categories/CategoriesScreen';
import { CategoryFormScreen } from '../screens/categories/CategoryFormScreen';
import { SettingsHeaderButton } from '../components/ui/SettingsHeaderButton';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BudgetStackParamList } from './types';

const Stack = createNativeStackNavigator<BudgetStackParamList>();

function BudgetHeaderRight() {
  const navigation = useNavigation<NativeStackNavigationProp<BudgetStackParamList, 'BudgetHome'>>();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Pressable onPress={() => navigation.navigate('ManageCategories')}>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>Categories</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Transactions')}>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>All</Text>
      </Pressable>
    </View>
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
      <Stack.Screen name="ManageCategories" component={CategoriesScreen} options={{ title: 'Categories' }} />
      <Stack.Screen name="CategoryForm" component={CategoryFormScreen} options={{ title: 'Category' }} />
    </Stack.Navigator>
  );
}
