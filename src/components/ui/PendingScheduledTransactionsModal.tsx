import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { formatMoney } from '../../domain/money';
import type { ScheduledTransactionWithLabels } from '../../domain/types';

interface PendingScheduledTransactionsModalProps {
  visible: boolean;
  items: ScheduledTransactionWithLabels[];
  onApprove: (id: number) => void;
  onClose: () => void;
}

// One row per due schedule — approving posts it (see
// usePendingScheduledTransactions.approve) and the row disappears once the
// list re-fetches. No reject/skip action: declining to approve just leaves
// it pending, same as never opening this modal.
export function PendingScheduledTransactionsModal({ visible, items, onApprove, onClose }: PendingScheduledTransactionsModalProps) {
  const t = useT();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('pendingScheduled.title')}</Text>
          {items.length === 0 ? (
            <Text style={styles.empty}>{t('pendingScheduled.empty')}</Text>
          ) : (
            <ScrollView style={styles.list}>
              {items.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowPayee} numberOfLines={1}>
                      {item.payeeName || t('common.uncategorized')}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {item.accountName} · {item.nextDate}
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: item.amountCents < 0 ? colors.negative : colors.positive }]}>
                    {formatMoney(item.amountCents)}
                  </Text>
                  <Pressable style={styles.approveBtn} onPress={() => onApprove(item.id)}>
                    <Text style={styles.approveBtnText}>{t('pendingScheduled.approve')}</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t('common.done')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: {
    maxHeight: '75%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  empty: { color: colors.textMuted, fontSize: 14, paddingVertical: spacing.lg, textAlign: 'center' },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowPayee: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700' },
  approveBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  closeBtn: { alignItems: 'center', paddingVertical: 12, marginTop: spacing.xs },
  closeBtnText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
});
