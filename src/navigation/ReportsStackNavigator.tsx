import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import type { ReportsStackParamList } from './types';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export function ReportsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ReportsHome" component={ReportsScreen} options={{ title: 'Reports' }} />
    </Stack.Navigator>
  );
}
