import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { CategoriesScreen } from '../screens/categories/CategoriesScreen';
import { CategoryFormScreen } from '../screens/categories/CategoryFormScreen';
import type { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="ManageCategories" component={CategoriesScreen} options={{ title: 'Categories' }} />
      <Stack.Screen name="CategoryForm" component={CategoryFormScreen} options={{ title: 'Category' }} />
    </Stack.Navigator>
  );
}
