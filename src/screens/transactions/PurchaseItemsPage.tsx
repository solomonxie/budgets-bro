import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PurchaseItemsField } from '../../components/ui/PurchaseItemsField';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// What was in the bag, in a short sheet: the spend form keeps one row for
// it, and this is where the list is typed — names and prices on the system
// keyboard. A few rows is all it ever holds, so 40% of the screen, riding
// up above the keyboard, rather than a whole page.
export function PurchaseItemsPage({
  value,
  onChange,
  nameOptions,
  totalCents,
  onClose,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  nameOptions: string[];
  totalCents?: number;
  onClose: () => void;
}) {
  const t = useT();
  const { height } = useWindowDimensions();
  // Focus waits for the sheet to finish sliding in: a field focused inside
  // a Modal that isn't shown yet gets no keyboard.
  const [shown, setShown] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);

  // The row being typed goes to the top of the sheet, so it and the name
  // chips under it are never behind the keyboard or the header.
  const revealRow = useCallback((node: View | null) => {
    const content = contentRef.current;
    if (!node || !content) return;
    node.measureLayout(content, (_x, y) =>
      scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true }),
    );
  }, []);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setShown(true)}
    >
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { height: height * 0.4 }]}>
          <View style={styles.header}>
            <Text style={[styles.headerBtn, styles.hidden]}>
              {t('common.done')}
            </Text>
            <Text style={styles.title}>{t('purchaseItems.label')}</Text>
            <Pressable hitSlop={8} onPress={onClose}>
              <Text style={styles.headerBtn}>{t('common.done')}</Text>
            </Pressable>
          </View>
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled">
            <View ref={contentRef} style={styles.content}>
              <PurchaseItemsField
                value={value}
                onChange={onChange}
                nameOptions={nameOptions}
                totalCents={totalCents}
                autoFocus={shown}
                onRevealRow={revealRow}
              />
            </View>
          </ScrollView>
        </View>
        <SafeAreaView edges={['bottom']} style={styles.sheetBg} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetBg: { backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  headerBtn: { fontSize: 16, fontWeight: '600', color: colors.accent },
  hidden: { opacity: 0 },
  content: { padding: spacing.md, paddingTop: 0 },
});
