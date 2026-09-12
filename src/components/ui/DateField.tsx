import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useI18n, localeTag } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface DateFieldProps {
  label: string;
  value: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
}

function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y || new Date().getFullYear(), (m || 1) - 1, d || 1);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDisplay(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' });
}

// A hand-rolled scroll-wheel picker kept losing the drag gesture inside the
// confirm-sheet Modal, however it was built — this is the real OS date
// picker (spinner wheels on iOS, same widget on Android via this library),
// so it just scrolls.
export function DateField({ label, value, onChange }: DateFieldProps) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseDate(value));

  const openPicker = () => {
    setDraft(parseDate(value));
    setOpen(true);
  };

  const confirm = () => {
    onChange(formatDate(draft));
    setOpen(false);
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={styles.valueText}>{formatDisplay(parseDate(value), localeTag(language))}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{label}</Text>
            <DateTimePicker
              value={draft}
              mode="date"
              display="spinner"
              onValueChange={(_, d) => setDraft(d)}
              textColor={colors.text}
              style={styles.picker}
            />
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
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  valueText: { fontSize: 15, color: colors.text, flex: 1 },
  chevron: { color: colors.textMuted, fontSize: 13, marginLeft: spacing.sm },
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
  picker: { alignSelf: 'center' },
  confirmBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: spacing.xs },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
