import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ToolsScreen } from '../screens/tools/ToolsScreen';
import type { ToolsStackParamList } from './types';

const Stack = createNativeStackNavigator<ToolsStackParamList>();

export function ToolsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ToolsHome" component={ToolsScreen} options={{ title: 'Tools' }} />
    </Stack.Navigator>
  );
}
