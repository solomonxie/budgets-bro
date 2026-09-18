import { useEffect, useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from './TextField';
import { DateField } from './DateField';
import { useT } from '../../i18n';
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

function splitSign(value: string): { negative: boolean; magnitude: string } {
  const trimmed = value.trim();
  return trimmed.startsWith('-') ? { negative: true, magnitude: trimmed.slice(1) } : { negative: false, magnitude: trimmed };
}

// Add/edit one reading in an account's logged history (account_value_history):
// the figure, the date it took effect, and where the number came from. Used
// for both kinds that table holds — a home's value and a loan's remaining
// principal (see migration 024) — so the wording comes in as props. Same
// small-card modal shell as RateChangeModal. The sign toggle exists because
// decimal-pad has no minus key on iOS, and a home value can go negative
// (underwater on the loan).
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
  const [negative, setNegative] = useState(false);
  const [magnitude, setMagnitude] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      const split = splitSign(initial.value);
      setNegative(split.negative);
      setMagnitude(split.magnitude);
      setEffectiveDate(initial.effectiveDate);
      setNote(initial.note);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = () => {
    if (!magnitude.trim() || !effectiveDate.trim()) return;
    onSubmit({ value: `${negative ? '-' : ''}${magnitude.trim()}`, effectiveDate: effectiveDate.trim(), note: note.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Stops the tap reaching the backdrop (which cancels), and puts
            the keyboard away — tapping off a field inside the card used to
            do nothing at all, leaving the pad covering the buttons. */}
        <Pressable
          style={styles.card}
          onPress={(e) => {
            e.stopPropagation();
            Keyboard.dismiss();
          }}
        >
          <Text style={styles.title}>{title}</Text>
          <View style={styles.valueRow}>
            <Pressable style={styles.signToggle} onPress={() => setNegative((v) => !v)}>
              <Text style={styles.signToggleText}>{negative ? '−' : '+'}</Text>
            </Pressable>
            <View style={styles.valueInput}>
              <TextField
                label={valueLabel}
                value={magnitude}
                onChangeText={setMagnitude}
                keyboardType="decimal-pad"
                placeholder={t('common.amountPlaceholder')}
                autoFocus
              />
            </View>
          </View>
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
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  valueInput: { flex: 1 },
  signToggle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signToggleText: { fontSize: 20, fontWeight: '700', color: colors.accent },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deleteText: { color: colors.negative, fontWeight: '600' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
