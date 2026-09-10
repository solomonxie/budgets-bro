import { Pressable, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

// Top-left stand-in for a bottom Settings tab.
export function SettingsHeaderButton() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  return (
    <Pressable onPress={() => navigation.navigate('Settings', { screen: 'SettingsHome' })} hitSlop={10}>
      <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 15 }}>Settings</Text>
    </Pressable>
  );
}
