import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { TextField } from './TextField';
import { MoneyField } from './MoneyField';
import { DateField } from './DateField';
import { useT } from '../../i18n';
import { FormSheet } from './FormSheet';
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
  // Unfold where the button was rather than covering the page — see
  // FormSheet.
  inline?: boolean;
}

// Add/edit one reading in an account's logged history (account_value_history):
// the figure, the date it took effect, and where the number came from. Every
// kind of reading uses it — a home's value, an investment's total, a loan's
// remaining principal (see migration 024) — so all the wording comes in as
// props: a dialog headed "Home Value" on an RRSP is worse than no heading.
// A pushed sheet rather than a popup — see FormSheet.
export function LoggedValueModal({
  visible,
  title,
  valueLabel,
  notePlaceholder,
  initial,
  onCancel,
  onSubmit,
  onDelete,
  inline,
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
    onSubmit({
      value: magnitude.trim(),
      effectiveDate: effectiveDate.trim(),
      note: note.trim(),
    });
  };

  return (
    <FormSheet
      visible={visible}
      title={title}
      onCancel={onCancel}
      onSave={submit}
      inline={inline}
    >
      <MoneyField
        label={valueLabel}
        value={magnitude}
        onChangeText={setMagnitude}
        placeholder={t('common.amountPlaceholder')}
        autoFocus
      />
      <DateField
        label={t('common.effectiveDateLabel')}
        value={effectiveDate}
        onChange={setEffectiveDate}
      />
      <TextField
        label={t('loggedValueModal.noteLabel')}
        value={note}
        onChangeText={setNote}
        placeholder={notePlaceholder}
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
  // Away from Save, at the end of the form — the account editor puts its
  // Close Account link in the same place.
  deleteRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  deleteText: { color: colors.negative, fontWeight: '600' },
});
