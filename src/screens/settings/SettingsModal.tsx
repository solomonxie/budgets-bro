import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsScreen } from './SettingsScreen';
import { useAppStore } from '../../state/useAppStore';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Settings moved out of the bottom tabs (opened from a corner button
// instead) — a plain full-screen Modal, since SettingsScreen has no
// navigation dependency of its own to preserve.
export function SettingsModal() {
  const t = useT();
  const open = useAppStore((s) => s.settingsModal.open);
  const close = useAppStore((s) => s.closeSettings);

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settingsModal.title')}</Text>
          <Pressable onPress={close} hitSlop={10}>
            <Text style={styles.doneBtn}>{t('common.done')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      <SettingsScreen />
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerSafeArea: { backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  doneBtn: { fontSize: 15, fontWeight: '600', color: colors.accent },
});
