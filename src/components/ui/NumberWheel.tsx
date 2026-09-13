import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface NumberWheelProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}

// Tap to pop the real native number wheel (UIPickerView on iOS, the same
// widget Android's Picker renders) — same "Pressable field -> Modal card"
// shell as DateField, just a plain integer instead of a date.
export function NumberWheel({ label, value, onChange, min, max }: NumberWheelProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const openPicker = () => {
    setDraft(value);
    setOpen(true);
  };

  const confirm = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <View>
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={styles.valueText}>{value}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{label}</Text>
            <Picker selectedValue={draft} onValueChange={(v) => setDraft(Number(v))} itemStyle={styles.pickerItem}>
              {numbers.map((n) => (
                <Picker.Item key={n} label={String(n)} value={n} />
              ))}
            </Picker>
            <Pressable style={styles.confirmBtn} onPress={confirm}>
              <Text style={styles.confirmBtnText}>{t('common.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    minWidth: 52,
  },
  valueText: { fontSize: 15, color: colors.text },
  chevron: { color: colors.textMuted, fontSize: 11, marginLeft: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
  pickerItem: { color: colors.text },
  confirmBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: spacing.xs },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
