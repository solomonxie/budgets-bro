import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TabBarIcon } from './TabBarIcon';
import type { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

// Top-left corner entry point into Settings — each tab's native stack header
// (BudgetHome/AccountsList/InsightsHome) uses this as headerLeft, since
// Settings isn't a bottom tab itself anymore.
//
// navigate, not a modal: this bubbles up out of the tab's own stack to the
// root one, so Settings arrives as a full page with a back button to
// wherever you were.
export function SettingsButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable style={styles.button} onPress={() => navigation.navigate('Settings')} hitSlop={10}>
      <TabBarIcon name="settings" color={colors.textMuted} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: 'flex-start' },
});
