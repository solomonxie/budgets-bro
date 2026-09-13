import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from './TextField';
import { DateField } from './DateField';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { IncomeUnit } from '../../domain/types';

export interface IncomeDetailValue {
  amount: string; // dollars
  unit: IncomeUnit;
  effectiveDate: string;
  note: string;
}

interface IncomeDetailModalProps {
  visible: boolean;
  initial: IncomeDetailValue;
  onCancel: () => void;
  onSubmit: (value: IncomeDetailValue) => void;
  onDelete?: () => void;
}

const UNITS: IncomeUnit[] = ['year', 'month', 'hour', 'paycheck'];
const UNIT_LABEL_KEY: Record<IncomeUnit, TranslationKey> = {
  year: 'incomeDetailModal.unitYear',
  month: 'incomeDetailModal.unitMonth',
  hour: 'incomeDetailModal.unitHour',
  paycheck: 'incomeDetailModal.unitPaycheck',
};

// Add/edit one row of an Income account's pay-rate history (e.g. "$45/hr
// as of March", "$95,000/yr as of the last raise") — same small
// transparent-card shell as RateChangeModal, generalized with a unit
// instead of assuming an annual percentage rate.
export function IncomeDetailModal({ visible, initial, onCancel, onSubmit, onDelete }: IncomeDetailModalProps) {
  const t = useT();
  const [amount, setAmount] = useState(initial.amount);
  const [unit, setUnit] = useState<IncomeUnit>(initial.unit);
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate);
  const [note, setNote] = useState(initial.note);

  useEffect(() => {
    if (visible) {
      setAmount(initial.amount);
      setUnit(initial.unit);
      setEffectiveDate(initial.effectiveDate);
      setNote(initial.note);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = () => {
    if (!amount.trim()) return;
    onSubmit({ amount: amount.trim(), unit, effectiveDate, note: note.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('incomeDetailModal.title')}</Text>
          <TextField
            label={t('incomeDetailModal.amountLabel')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
            autoFocus
          />
          <View style={styles.segmented}>
            {UNITS.map((u) => (
              <Pressable key={u} style={[styles.segment, unit === u && styles.segmentActive]} onPress={() => setUnit(u)}>
                <Text style={[styles.segmentText, unit === u && styles.segmentTextActive]}>{t(UNIT_LABEL_KEY[u])}</Text>
              </Pressable>
            ))}
          </View>
          <DateField label={t('common.effectiveDateLabel')} value={effectiveDate} onChange={setEffectiveDate} />
          <TextField label={t('incomeDetailModal.noteLabel')} value={note} onChangeText={setNote} placeholder={t('incomeDetailModal.notePlaceholder')} />
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
  segmentText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deleteText: { color: colors.negative, fontWeight: '600' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
