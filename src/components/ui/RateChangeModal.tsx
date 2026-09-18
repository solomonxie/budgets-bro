import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { TextField } from './TextField';
import { DateField } from './DateField';
import { useT } from '../../i18n';
import { FormSheet } from './FormSheet';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface RateChangeValue {
  ratePercent: string;
  effectiveDate: string;
  note: string;
}

interface RateChangeModalProps {
  visible: boolean;
  initial: RateChangeValue;
  onCancel: () => void;
  onSubmit: (value: RateChangeValue) => void;
  onDelete?: () => void;
}

// Add/edit one row of a loan's interest-rate history (rate + the date it
// took effect) — same small-card modal shell as PromptModal, two fields.
export function RateChangeModal({ visible, initial, onCancel, onSubmit, onDelete }: RateChangeModalProps) {
  const t = useT();
  const [ratePercent, setRatePercent] = useState(initial.ratePercent);
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      setRatePercent(initial.ratePercent);
      setEffectiveDate(initial.effectiveDate);
      setNote(initial.note);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = () => {
    if (!ratePercent.trim() || !effectiveDate.trim()) return;
    onSubmit({ ratePercent: ratePercent.trim(), effectiveDate: effectiveDate.trim(), note: note.trim() });
  };

  return (
    <FormSheet visible={visible} title={t('rateChangeModal.title')} onCancel={onCancel} onSave={submit}>
      <TextField
        label={t('rateChangeModal.rateLabel')}
        value={ratePercent}
        onChangeText={setRatePercent}
        keyboardType="decimal-pad"
        placeholder={t('rateChangeModal.ratePlaceholder')}
        autoFocus
      />
      <DateField label={t('common.effectiveDateLabel')} value={effectiveDate} onChange={setEffectiveDate} />
      <TextField
        label={t('loggedValueModal.noteLabel')}
        value={note}
        onChangeText={setNote}
        placeholder={t('rateChangeModal.notePlaceholder')}
      />
      {onDelete ? (
        <Pressable style={styles.deleteRow} onPress={onDelete}>
          <Text style={styles.deleteText}>{t('common.delete')}</Text>
        </Pressable>
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  deleteRow: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.md },
  deleteText: { color: colors.negative, fontWeight: '600' },
});
