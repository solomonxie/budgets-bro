import { useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { BottomSheet } from './BottomSheet';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface Option {
  id: number;
  label: string;
}

// ~5 option rows tall — fixed regardless of how many results a search
// narrows the list down to.
const COMPACT_LIST_HEIGHT = 240;

// Substring match ranks highest (by position); otherwise falls back to an
// in-order fuzzy subsequence match (typo/skip-tolerant), scored by how
// contiguous the matched characters are. Null means no match at all.
function fuzzyScore(label: string, query: string): number | null {
  const idx = label.indexOf(query);
  if (idx !== -1) return 10000 - idx;

  let li = 0;
  let run = 0;
  let score = 0;
  for (const ch of query) {
    const found = label.indexOf(ch, li);
    if (found === -1) return null;
    run = found === li ? run + 1 : 0;
    score += run;
    li = found + 1;
  }
  return score;
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
  // Same half-height bottom sheet as DropdownField's compact mode — see its
  // doc comment. Off by default (a full-screen page, same as before) since
  // most callers of this one manage a long list.
  compact?: boolean;
  // Skips the label row above the field to save vertical space — the
  // picker sheet/page still uses `label` as its title, and `placeholder`
  // becomes the only clue to what the field is when empty, so pass a
  // meaningful one.
  hideLabel?: boolean;
}

export function SearchableDropdownField({
  label,
  valueLabel,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  options,
  onSelect,
  onUseText,
  compact,
  hideLabel,
}: SearchableDropdownFieldProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const close = () => {
    setOpen(false);
    setQuery('');
  };

  // Resigns first responder (not just visual) before presenting the picker's
  // own Modal — otherwise iOS restores focus to whatever was last focused
  // (e.g. the Spend form's amount field) the instant this Modal closes,
  // popping its keyboard back up regardless of what was actually picked.
  const openPicker = () => {
    Keyboard.dismiss();
    setOpen(true);
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options
        .map((o) => ({ o, score: fuzzyScore(o.label.toLowerCase(), q) }))
        .filter((m): m is { o: Option; score: number } => m.score != null)
        .sort((a, b) => b.score - a.score)
        .map((m) => m.o)
    : options;
  const hasExactMatch = options.some((o) => o.label.toLowerCase() === q);

  const searchBox = (
    <TextInput
      style={styles.search}
      placeholder={searchPlaceholder}
      placeholderTextColor={colors.textMuted}
      keyboardAppearance="dark"
      value={query}
      onChangeText={setQuery}
      autoFocus
      autoCorrect={false}
      autoComplete="off"
      spellCheck={false}
      textContentType="none"
      importantForAutofill="no"
    />
  );

  const optionRows = (
    <>
      {query.trim() && !hasExactMatch ? (
        <Pressable
          style={styles.option}
          onPress={() => {
            onUseText(query.trim());
            close();
          }}
        >
          <Text style={styles.useText}>{t('searchableDropdown.useText', { text: query.trim() })}</Text>
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
    </>
  );

  return (
    <View>
      {hideLabel ? null : <Text style={styles.label}>{label}</Text>}
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={[styles.valueText, !valueLabel && styles.placeholder]} numberOfLines={1}>
          {valueLabel || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {compact ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
          {/* Keeps the sheet from shrink-wrapping to a sliver — and sliding
              down behind the keyboard — once typing narrows the results to
              just one or two rows. */}
          <BottomSheet title={label} onClose={close} stickyContent={searchBox} listHeight={COMPACT_LIST_HEIGHT}>
            {optionRows}
          </BottomSheet>
        </Modal>
      ) : (
        // iOS lets a pageSheet be swiped down to dismiss directly, without
        // ever pressing the button — onDismiss keeps `open` in sync with
        // that, same as pressing Back would.
        <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close} onDismiss={close}>
          <ScreenContainer modal>
            <View style={styles.header}>
              <Pressable onPress={close} hitSlop={10}>
                <Text style={styles.headerBtn}>{t('common.back')}</Text>
              </Pressable>
              <Text style={styles.title} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[styles.headerBtn, styles.headerBtnGhost]}>{t('common.back')}</Text>
            </View>
            {searchBox}
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {optionRows}
            </ScrollView>
          </ScreenContainer>
        </Modal>
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.accent },
  headerBtnGhost: { opacity: 0 },
  title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.text, marginHorizontal: spacing.sm },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
  list: { flex: 1, marginTop: spacing.xs },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: 15, color: colors.text },
  useText: { fontSize: 15, color: colors.accent, fontWeight: '600' },
});
