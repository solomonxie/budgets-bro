import type { ReactNode } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
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
export function FormSheet({
  visible,
  title,
  onCancel,
  onSave,
  children,
}: {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <ScreenContainer modal>
        <View style={styles.header}>
          <Pressable onPress={onCancel}>
            <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onSave}>
            <Text style={[styles.headerBtn, styles.saveBtn]}>{t('common.save')}</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  saveBtn: { color: colors.accent },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  fields: { gap: spacing.md },
});
