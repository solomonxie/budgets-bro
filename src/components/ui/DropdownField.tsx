import { useState } from 'react';
import type { ReactNode } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { BottomSheet } from './BottomSheet';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface DropdownFieldProps {
  label: string;
  valueLabel: string;
  placeholder?: string;
  children: (close: () => void) => ReactNode;
  // Half-height bottom sheet (swipe down or drag the handle to dismiss,
  // same as the full-screen picker's Back) instead of a full-screen page —
  // this is the default look now for every picker in the app, including
  // long/grouped ones (category, payee). Leave off only where a filter
  // dropdown genuinely benefits from the extra room (see TransactionsScreen).
  compact?: boolean;
}

export function DropdownField({ label, valueLabel, placeholder = 'Select…', children, compact }: DropdownFieldProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Dismiss the keyboard (not just visually — resigns first responder)
  // before presenting the picker's own native Modal. Two stacked native
  // Modals otherwise leave iOS with a stale "last focused" text input to
  // restore focus to — and pop the keyboard back up — the instant the
  // picker closes, regardless of what was actually picked.
  const openPicker = () => {
    Keyboard.dismiss();
    setOpen(true);
  };

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={[styles.valueText, !valueLabel && styles.placeholder]} numberOfLines={1}>
          {valueLabel || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {compact ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
          <BottomSheet title={label} onClose={close}>
            {children(close)}
          </BottomSheet>
        </Modal>
      ) : (
        // iOS lets a pageSheet be swiped down to dismiss directly, without
        // ever pressing the button — onDismiss keeps `open` in sync with
        // that, same as pressing Back would.
        <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close} onDismiss={close}>
          <ScreenContainer modal>
            <View style={styles.header}>
              <Pressable onPress={close} hitSlop={10}>
                <Text style={styles.headerBtn}>{t('common.back')}</Text>
              </Pressable>
              <Text style={styles.title} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[styles.headerBtn, styles.headerBtnGhost]}>{t('common.back')}</Text>
            </View>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {children(close)}
            </ScrollView>
          </ScreenContainer>
        </Modal>
      )}
    </View>
  );
}

interface DropdownOptionProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

export function DropdownOption({ label, selected, onPress }: DropdownOptionProps) {
  return (
    <Pressable style={styles.option} onPress={onPress}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
      {selected ? <Text style={styles.check}>✓</Text> : null}
    </Pressable>
  );
}

export function DropdownGroupLabel({ label }: { label: string }) {
  return <Text style={styles.groupLabel}>{label}</Text>;
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  valueText: { fontSize: 15, color: colors.text, flex: 1 },
  placeholder: { color: colors.textMuted },
  chevron: { color: colors.textMuted, fontSize: 13, marginLeft: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.accent },
  // Same width as the real Cancel on the left, invisible — keeps the title
  // visually centered without a real right-side action.
  headerBtnGhost: { opacity: 0 },
  title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.text, marginHorizontal: spacing.sm },
  list: { flex: 1 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: 15, color: colors.text },
  optionTextSelected: { fontWeight: '700', color: colors.accent },
  check: { color: colors.accent, fontWeight: '700' },
});
