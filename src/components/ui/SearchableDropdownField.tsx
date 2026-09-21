import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { FieldRow } from './FieldCard';
import { BottomSheet } from './BottomSheet';
import { ExpandedPanel, useExpandingField } from './ExpandingField';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface Option {
  id: number;
  label: string;
  // A short pill after the label, for an option that behaves differently
  // from its neighbours — an account-linked payee posts a transfer rather
  // than just naming who was paid.
  badge?: string;
  // Shows this row's rename button (only where the caller passed
  // `onEditOption`) — an account-linked payee is named by its account, so
  // it opts out.
  editable?: boolean;
}

// ~5 option rows tall — fixed regardless of how many results a search
// narrows the list down to.
const COMPACT_LIST_HEIGHT = 5 * 54;

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
  // Per-row rename, offered on `editable` options. Fixing a name where you
  // notice it is wrong — in the list you are reading — beats hunting the
  // same name down in a management screen somewhere else.
  onEditOption?: (option: Option) => void;
  // Same half-height bottom sheet as DropdownField's compact mode — see its
  // doc comment. Off by default (a full-screen page, same as before) since
  // most callers of this one manage a long list.
  compact?: boolean;
  // Skips the label row above the field to save vertical space — the
  // picker sheet/page still uses `label` as its title, and `placeholder`
  // becomes the only clue to what the field is when empty, so pass a
  // meaningful one.
  hideLabel?: boolean;
  // Renders as a row of a FieldCard — see DropdownField's `row`.
  row?: boolean;
  // Draws the field itself, for a caller that needs it beside something
  // else (the purchase-items row puts a price and a remove next to it).
  // The unfolded list still belongs to this component, so it spans the
  // caller's full width instead of the narrow column the field sits in.
  renderField?: (open: () => void, expanded: boolean) => ReactNode;
}

export function SearchableDropdownField({
  label,
  valueLabel,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  options,
  onSelect,
  onUseText,
  onEditOption,
  compact,
  hideLabel,
  row,
  renderField,
}: SearchableDropdownFieldProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Non-null inside an ExpandingFieldGroup: the list unfolds under this row
  // instead of in a sheet (see ExpandingField).
  const inline = useExpandingField();
  const close = () => {
    inline?.close();
    setOpen(false);
    setQuery('');
  };

  // Resigns first responder (not just visual) before presenting the picker's
  // own Modal — otherwise iOS restores focus to whatever was last focused
  // (e.g. the Spend form's amount field) the instant this Modal closes,
  // popping its keyboard back up regardless of what was actually picked.
  const openPicker = () => {
    Keyboard.dismiss();
    if (inline) {
      setQuery('');
      inline.toggle();
      return;
    }
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
      style={[styles.search, inline && row && styles.searchInline]}
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
          <Text style={styles.useText}>
            {t('searchableDropdown.useText', { text: query.trim() })}
          </Text>
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
          <Text style={styles.optionText} numberOfLines={1}>
            {o.label}
          </Text>
          {o.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{o.badge}</Text>
            </View>
          ) : null}
          {onEditOption && o.editable ? (
            // Nested Pressable: the inner one claims the touch, so editing
            // never doubles as selecting the row it sits on.
            <Pressable
              hitSlop={10}
              style={styles.edit}
              onPress={() => {
                Keyboard.dismiss();
                onEditOption(o);
              }}
            >
              <Text style={styles.editText}>✎</Text>
            </Pressable>
          ) : null}
        </Pressable>
      ))}
    </>
  );

  return (
    <View>
      {renderField ? (
        renderField(openPicker, inline?.expanded ?? open)
      ) : row ? (
        <FieldRow
          label={label}
          value={valueLabel}
          onPress={openPicker}
          expanded={inline?.expanded}
        />
      ) : (
        <>
          {hideLabel ? null : <Text style={styles.label}>{label}</Text>}
          <Pressable style={styles.field} onPress={openPicker}>
            <Text
              style={[styles.valueText, !valueLabel && styles.placeholder]}
              numberOfLines={1}
            >
              {valueLabel || placeholder}
            </Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>
        </>
      )}
      {inline ? (
        inline.expanded ? (
          <ExpandedPanel sticky={searchBox}>{optionRows}</ExpandedPanel>
        ) : null
      ) : compact ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={close}
        >
          {/* Keeps the sheet from shrink-wrapping to a sliver — and sliding
              down behind the keyboard — once typing narrows the results to
              just one or two rows. */}
          <BottomSheet
            title={label}
            onClose={close}
            stickyContent={searchBox}
            listHeight={COMPACT_LIST_HEIGHT}
          >
            {optionRows}
          </BottomSheet>
        </Modal>
      ) : (
        // iOS lets a pageSheet be swiped down to dismiss directly, without
        // ever pressing the button — onDismiss keeps `open` in sync with
        // that, same as pressing Back would.
        <Modal
          visible={open}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={close}
          onDismiss={close}
        >
          <ScreenContainer modal>
            <View style={styles.header}>
              <Pressable onPress={close} hitSlop={10}>
                <Text style={styles.headerBtn}>{t('common.back')}</Text>
              </Pressable>
              <Text style={styles.title} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[styles.headerBtn, styles.headerBtnGhost]}>
                {t('common.back')}
              </Text>
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
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
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.sm,
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
    marginTop: spacing.sm,
  },
  // Unfolded in place *inside a FieldCard* the box is a row of that card,
  // not a box inside it: full width, square, its text on the same left edge
  // as the label above it. Only there — a field standing on its own (the
  // payee manager in Settings, the review page's cards) has no card edge to
  // run to, so full-bleed just overhangs its section and cuts its own
  // corners off. Those keep the bordered box.
  searchInline: {
    borderWidth: 0,
    borderRadius: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginTop: 0,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  list: { flex: 1, marginTop: spacing.xs },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 17,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { flex: 1, fontSize: 15, color: colors.text },
  badge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  edit: { paddingHorizontal: spacing.sm },
  editText: { fontSize: 15, color: colors.textMuted },
  useText: { fontSize: 15, color: colors.accent, fontWeight: '600' },
});
