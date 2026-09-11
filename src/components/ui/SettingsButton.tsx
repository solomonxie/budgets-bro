import { Pressable, StyleSheet } from 'react-native';
import { TabBarIcon } from './TabBarIcon';
import { useAppStore } from '../../state/useAppStore';
import { colors } from '../../theme/colors';

// Top-left corner entry point into Settings (see SettingsModal) — placed
// on each tab's home screen, now that Settings isn't a bottom tab itself.
export function SettingsButton() {
  const openSettings = useAppStore((s) => s.openSettings);
  return (
    <Pressable style={styles.button} onPress={openSettings} hitSlop={10}>
      <TabBarIcon name="settings" color={colors.textMuted} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: 'flex-start' },
});
