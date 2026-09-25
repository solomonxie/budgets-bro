import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { PurchaseItemsField } from '../../components/ui/PurchaseItemsField';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// What was in the bag, on its own page: the spend form keeps one row for it,
// and this is where the list is typed — names and prices on the system
// keyboard, since nothing else here needs the space.
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
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ScreenContainer modal>
        <View style={styles.header}>
          <Text style={[styles.headerBtn, styles.hidden]}>
            {t('common.done')}
          </Text>
          <Text style={styles.title}>{t('purchaseItems.label')}</Text>
          <Pressable hitSlop={8} onPress={onClose}>
            <Text style={styles.headerBtn}>{t('common.done')}</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <PurchaseItemsField
            value={value}
            onChange={onChange}
            nameOptions={nameOptions}
            totalCents={totalCents}
          />
        </ScrollView>
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  content: { padding: spacing.md },
});
