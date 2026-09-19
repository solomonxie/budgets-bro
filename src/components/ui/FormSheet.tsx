import type { ReactNode } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { ExpandingFieldGroup } from './ExpandingField';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// A pushed sheet for a short form — Cancel left, title centre, Save right,
// same header the account editor uses. The small centred card it replaces
// spent its life fighting the keyboard: lifted, scrolled, still cramped. A
// full page has room for the fields and leaves the keyboard the bottom half
// of the screen, which is where it was going to be anyway.
//
// Anything destructive belongs in `children`, at the bottom, away from Save.
//
// `inline` drops the sheet entirely and unfolds the same form where the
// button that opened it stands — for a form that belongs to a list you are
// already looking at (a value reading, a rate change), where covering that
// list to type one number into it is the wrong trade. Its own pickers unfold
// in place too, so nothing on the page is ever hidden behind anything else.
export function FormSheet({
  visible,
  title,
  onCancel,
  onSave,
  inline,
  children,
}: {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onSave: () => void;
  inline?: boolean;
  children: ReactNode;
}) {
  const t = useT();

  if (inline) {
    if (!visible) return null;
    return (
      <ExpandingFieldGroup>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={styles.panelCancel}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.panelTitle}>{title}</Text>
            <Pressable onPress={onSave} hitSlop={8}>
              <Text style={[styles.panelBtn, styles.saveBtn]}>
                {t('common.save')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.fields}>{children}</View>
        </View>
      </ExpandingFieldGroup>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <ScreenContainer modal>
        <View style={styles.header}>
          <Pressable onPress={onCancel}>
            <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onSave}>
            <Text style={[styles.headerBtn, styles.saveBtn]}>
              {t('common.save')}
            </Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // Keeps a field near the bottom of the sheet out from behind the
          // keyboard, same as every other scrolling form.
          automaticallyAdjustKeyboardInsets
        >
          {/* Tapping a gap between fields puts the keyboard away, the same as
              on the spend form. */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.fields}>{children}</View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  panelBtn: { fontSize: 14, fontWeight: '700' },
  panelCancel: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  saveBtn: { color: colors.accent },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  fields: { gap: spacing.md },
});
