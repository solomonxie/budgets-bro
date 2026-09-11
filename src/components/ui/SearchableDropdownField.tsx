import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface Option {
  id: number;
  label: string;
}

interface SearchableDropdownFieldProps {
  label: string;
  valueLabel: string;
  placeholder?: string;
  searchPlaceholder?: string;
  options: Option[];
  onSelect: (option: Option) => void;
  // Free-text entry not matching any existing option — the caller decides
  // what "creating" means (e.g. just accepting the typed name; the payee
  // row itself gets created for real at save time either way).
  onUseText: (text: string) => void;
}

// Same bottom-sheet shell as DropdownField, plus a search box and a "Use
// <text>" fallback row — for pickers where free text is also valid input
// (payee), not just a closed set of options (category, account).
export function SearchableDropdownField({
  label,
  valueLabel,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  options,
  onSelect,
  onUseText,
}: SearchableDropdownFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const hasExactMatch = options.some((o) => o.label.toLowerCase() === q);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.valueText, !valueLabel && styles.placeholder]} numberOfLines={1}>
          {valueLabel || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <TextInput
              style={styles.search}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {query.trim() && !hasExactMatch ? (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onUseText(query.trim());
                    close();
                  }}
                >
                  <Text style={styles.useText}>Use “{query.trim()}”</Text>
                </Pressable>
              ) : null}
              {filtered.map((o) => (
                <Pressable
                  key={o.id}
                  style={styles.option}
                  onPress={() => {
                    onSelect(o);
                    close();
                  }}
                >
                  <Text style={styles.optionText}>{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.cancel} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
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
  placeholder: { color: colors.textMuted },
  chevron: { color: colors.textMuted, fontSize: 13, marginLeft: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    gap: spacing.sm,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: 15, color: colors.text },
  useText: { fontSize: 15, color: colors.accent, fontWeight: '600' },
  cancel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  cancelText: { fontSize: 16, fontWeight: '700', color: colors.text },
});
