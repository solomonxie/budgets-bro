import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from './TextField';
import { DateField } from './DateField';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export type TrackingValueMode = 'gain' | 'total';

export interface TrackingValueSubmit {
  valueCents: number;
  effectiveDate: string;
}

interface TrackingValueModalProps {
  visible: boolean;
  previousValueCents: number | null;
  initialValueCents: number | null;
  initialEffectiveDate: string;
  onCancel: () => void;
  onSubmit: (value: TrackingValueSubmit) => void;
  onDelete?: () => void;
}

// Logs one tracking/investment-account value snapshot. Two entry modes,
// since users track this two different ways (T8.6): type the period's
// gain/loss directly (new value = previous + entered gain), or type the
// current total balance directly. Both write the same row shape
// (accountValueHistoryRepo.addValueChange) — the mode is purely which
// field the user fills in, nothing is persisted about which mode was used.
export function TrackingValueModal({
  visible,
  previousValueCents,
  initialValueCents,
  initialEffectiveDate,
  onCancel,
  onSubmit,
  onDelete,
}: TrackingValueModalProps) {
  const t = useT();
  const [mode, setMode] = useState<TrackingValueMode>('total');
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(initialEffectiveDate);

  useEffect(() => {
    if (visible) {
      setMode('total');
      setAmount(initialValueCents != null ? (initialValueCents / 100).toString() : '');
      setEffectiveDate(initialEffectiveDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const switchMode = (next: TrackingValueMode) => {
    setMode(next);
    setAmount('');
  };

  const enteredCents = Math.round((parseFloat(amount) || 0) * 100);
  const resultCents = mode === 'gain' ? (previousValueCents ?? 0) + enteredCents : enteredCents;

  const submit = () => {
    if (!amount.trim() || !effectiveDate.trim()) return;
    onSubmit({ valueCents: resultCents, effectiveDate: effectiveDate.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('trackingValueModal.title')}</Text>
          <View style={styles.segmented}>
            <Pressable style={[styles.segment, mode === 'total' && styles.segmentActive]} onPress={() => switchMode('total')}>
              <Text style={[styles.segmentText, mode === 'total' && styles.segmentTextActive]}>
                {t('trackingValueModal.modeTotal')}
              </Text>
            </Pressable>
            <Pressable style={[styles.segment, mode === 'gain' && styles.segmentActive]} onPress={() => switchMode('gain')}>
              <Text style={[styles.segmentText, mode === 'gain' && styles.segmentTextActive]}>
                {t('trackingValueModal.modeGain')}
              </Text>
            </Pressable>
          </View>
          <TextField
            label={mode === 'gain' ? t('trackingValueModal.gainLabel') : t('trackingValueModal.totalLabel')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
            autoFocus
          />
          {mode === 'gain' && previousValueCents != null ? (
            <Text style={styles.hint}>{t('trackingValueModal.resultHint', { amount: formatMoney(resultCents) })}</Text>
          ) : null}
          <DateField label={t('common.effectiveDateLabel')} value={effectiveDate} onChange={setEffectiveDate} />
          <View style={styles.actions}>
            {onDelete ? (
              <Pressable onPress={onDelete}>
                <Text style={styles.deleteText}>{t('common.delete')}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={styles.rightActions}>
              <Pressable onPress={onCancel}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={submit}>
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
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
  segmented: { flexDirection: 'row', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  hint: { fontSize: 12, color: colors.textMuted },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deleteText: { color: colors.negative, fontWeight: '600' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
