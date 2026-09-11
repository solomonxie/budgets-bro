import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Pressable, Text } from 'react-native';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { colors } from '../theme/colors';
import type { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

// Settings is reached by jumping tabs (the Settings header button on other
// screens), not by pushing onto a stack — so there's no automatic back
// arrow. `getParent()` reaches the bottom tab navigator, whose default
// `backBehavior: 'history'` returns to whichever tab was active before.
function BackButton() {
  const navigation = useNavigation();
  return (
    <Pressable onPress={() => navigation.getParent()?.goBack()} hitSlop={10}>
      <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 15 }}>‹ Back</Text>
    </Pressable>
  );
}

export function SettingsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings', headerLeft: () => <BackButton /> }} />
    </Stack.Navigator>
  );
}
