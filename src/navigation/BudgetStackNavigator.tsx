import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Pressable, Text } from 'react-native';
import { BudgetScreen } from '../screens/budget/BudgetScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { SettingsButton } from '../components/ui/SettingsButton';
import { useT } from '../i18n';
import { colors } from '../theme/colors';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BudgetStackParamList } from './types';

const Stack = createNativeStackNavigator<BudgetStackParamList>();

function BudgetHeaderRight() {
  const navigation = useNavigation<NativeStackNavigationProp<BudgetStackParamList, 'BudgetHome'>>();
  const t = useT();
  return (
    <Pressable onPress={() => navigation.navigate('Transactions')}>
      <Text style={{ color: colors.accent, fontWeight: '600' }}>{t('nav.history')}</Text>
    </Pressable>
  );
}

export function BudgetStackNavigator() {
  const t = useT();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="BudgetHome"
        component={BudgetScreen}
        options={{ title: t('nav.budget'), headerLeft: () => <SettingsButton />, headerRight: () => <BudgetHeaderRight /> }}
      />
      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: t('nav.transactions') }} />
    </Stack.Navigator>
  );
}
