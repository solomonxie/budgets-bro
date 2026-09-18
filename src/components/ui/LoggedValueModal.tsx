import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from './TextField';
import { MoneyField } from './MoneyField';
import { DateField } from './DateField';
import { useT } from '../../i18n';
import { CardModal } from './CardModal';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface LoggedValueChange {
  value: string;
  effectiveDate: string;
  note: string;
}

interface LoggedValueModalProps {
  visible: boolean;
  title: string;
  valueLabel: string;
  notePlaceholder: string;
  initial: LoggedValueChange;
  onCancel: () => void;
  onSubmit: (value: LoggedValueChange) => void;
  onDelete?: () => void;
}

// Add/edit one reading in an account's logged history (account_value_history):
// the figure, the date it took effect, and where the number came from. Every
// kind of reading uses it — a home's value, an investment's total, a loan's
// remaining principal (see migration 024) — so all the wording comes in as
// props: a dialog headed "Home Value" on an RRSP is worse than no heading.
// Same small-card shell as RateChangeModal.
export function LoggedValueModal({
  visible,
  title,
  valueLabel,
  notePlaceholder,
  initial,
  onCancel,
  onSubmit,
  onDelete,
}: LoggedValueModalProps) {
  const t = useT();
  const [magnitude, setMagnitude] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      setMagnitude(initial.value.trim());
      setEffectiveDate(initial.effectiveDate);
      setNote(initial.note);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = () => {
    if (!magnitude.trim() || !effectiveDate.trim()) return;
    onSubmit({ value: magnitude.trim(), effectiveDate: effectiveDate.trim(), note: note.trim() });
  };

  return (
    <CardModal visible={visible} onCancel={onCancel}>
      <Text style={styles.title}>{title}</Text>
      <MoneyField
        label={valueLabel}
        value={magnitude}
        onChangeText={setMagnitude}
        placeholder={t('common.amountPlaceholder')}
        autoFocus
      />
      <DateField label={t('common.effectiveDateLabel')} value={effectiveDate} onChange={setEffectiveDate} />
      <TextField
        label={t('loggedValueModal.noteLabel')}
        value={note}
        onChangeText={setNote}
        placeholder={notePlaceholder}
      />
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
    </CardModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deleteText: { color: colors.negative, fontWeight: '600' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
