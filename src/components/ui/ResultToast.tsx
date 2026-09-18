import { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const VISIBLE_MS = 6000;

interface ResultToastProps {
  visible: boolean;
  title: string;
  lines: { label: string; value: string }[];
  onDismiss: () => void;
}

// What just happened, worth one glance and nothing more — it leaves on its
// own, or sooner if tapped. A settings section that stayed on screen
// afterwards used to hold this, which made a finished one-off action look
// like a permanent part of the page.
export function ResultToast({ visible, title, lines, onDismiss }: ResultToastProps) {
  const t = useT();
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });

  // Keyed on `visible` alone: a re-render mustn't restart the countdown, so
  // the callback is read through the ref rather than watched.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => dismiss.current(), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {lines.map((line) => (
            <View key={line.label} style={styles.row}>
              <Text style={styles.label}>{line.label}</Text>
              <Text style={styles.value}>{line.value}</Text>
            </View>
          ))}
          <Pressable style={styles.dismiss} onPress={onDismiss}>
            <Text style={styles.dismissText}>{t('common.done')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  label: { fontSize: 14, color: colors.textMuted, flexShrink: 1 },
  value: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'right' },
  dismiss: { alignSelf: 'flex-end', paddingTop: 4 },
  dismissText: { color: colors.accent, fontWeight: '700' },
});
