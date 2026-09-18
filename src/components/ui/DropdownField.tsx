import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { FieldRow } from './FieldCard';
import { BottomSheet } from './BottomSheet';
import { ExpandedPanel, useExpandingField } from './ExpandingField';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Five option rows — enough to see the list is a list, short enough that
// the sheet doesn't take the screen for an account picker with three
// entries in it.
const COMPACT_LIST_MAX_HEIGHT = 5 * 54;

interface DropdownFieldProps {
  label: string;
  valueLabel: string;
  placeholder?: string;
  // `close(after)` closes this picker and, once it's actually finished
  // dismissing (not just requested to), runs `after` — for a caller that
  // wants to present another modal/Alert next. Presenting on top of a
  // still-animating dismissal can wedge iOS's window presentation state
  // entirely (see RowMenuButton, which has the same mechanism for its own
  // sheet — this and that compose for pickers that also carry a row menu,
  // like Settings' board list).
  children: (close: (after?: () => void) => void) => ReactNode;
  // Half-height bottom sheet (swipe down or drag the handle to dismiss,
  // same as the full-screen picker's Back) instead of a full-screen page —
  // this is the default look now for every picker in the app, including
  // long/grouped ones (category, payee) and the history page's filters.
  compact?: boolean;
  // Skips the label row above the field to save vertical space — the
  // picker sheet/page still uses `label` as its title, and `placeholder`
  // becomes the only clue to what the field is when empty, so pass a
  // meaningful one.
  hideLabel?: boolean;
  // Renders as a row of a FieldCard — no box of its own, label above the
  // value, chevron at the end.
  row?: boolean;
  // Renders as plain tappable text rather than a bordered field — for a
  // filter, where the control sits above a list it is acting on and a boxed
  // input makes it look like something to fill in. `placeholder` carries the
  // unfiltered state ("All categories"), so no separate label is drawn.
  link?: boolean;
}

export function DropdownField({ label, valueLabel, placeholder = 'Select…', children, compact, hideLabel, row, link }: DropdownFieldProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);
  // Non-null inside an ExpandingFieldGroup: the options unfold under this row
  // instead of in a sheet, and no Modal is rendered at all — so `after` runs
  // straight away, there being no dismissal to wait for.
  const inline = useExpandingField();

  const runDismissed = () => {
    const fn = pendingRef.current;
    pendingRef.current = null;
    fn?.();
  };

  const close = (after?: () => void) => {
    if (inline) {
      inline.close();
      after?.();
      return;
    }
    pendingRef.current = after ?? null;
    setOpen(false);
    if (Platform.OS !== 'ios') runDismissed();
  };

  // Dismiss the keyboard (not just visually — resigns first responder)
  // before presenting the picker's own native Modal. Two stacked native
  // Modals otherwise leave iOS with a stale "last focused" text input to
  // restore focus to — and pop the keyboard back up — the instant the
  // picker closes, regardless of what was actually picked.
  const openPicker = () => {
    Keyboard.dismiss();
    if (inline) inline.toggle();
    else setOpen(true);
  };

  return (
    <View>
      {link ? (
        <Pressable onPress={openPicker} hitSlop={8}>
          <Text style={styles.linkText} numberOfLines={1}>
            {valueLabel || placeholder} ▾
          </Text>
        </Pressable>
      ) : row ? (
        <FieldRow label={label} value={valueLabel} onPress={openPicker} expanded={inline?.expanded} />
      ) : (
        <>
          {label && !hideLabel ? <Text style={styles.label}>{label}</Text> : null}
          <Pressable style={styles.field} onPress={openPicker}>
            <Text style={[styles.valueText, !valueLabel && styles.placeholder]} numberOfLines={1}>
              {valueLabel || placeholder}
            </Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>
        </>
      )}
      {inline ? (
        inline.expanded ? <ExpandedPanel>{children(close)}</ExpandedPanel> : null
      ) : compact ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => close()} onDismiss={runDismissed}>
          <BottomSheet title={label} onClose={close} listMaxHeight={COMPACT_LIST_MAX_HEIGHT}>
            {children(close)}
          </BottomSheet>
        </Modal>
      ) : (
        // iOS lets a pageSheet be swiped down to dismiss directly, without
        // ever pressing the button — onDismiss keeps `open` in sync with
        // that, same as pressing Back would, and still runs any pending
        // post-close action.
        <Modal
          visible={open}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => close()}
          onDismiss={() => {
            setOpen(false);
            runDismissed();
          }}
        >
          <ScreenContainer modal>
            <View style={styles.header}>
              <Pressable onPress={() => close()} hitSlop={10}>
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
  linkText: { fontSize: 14, fontWeight: '600', color: colors.accent },
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
    paddingVertical: 17,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: 15, color: colors.text },
  optionTextSelected: { fontWeight: '700', color: colors.accent },
  check: { color: colors.accent, fontWeight: '700' },
});
