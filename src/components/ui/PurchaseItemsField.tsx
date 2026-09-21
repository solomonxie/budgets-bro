import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SearchableDropdownField } from './SearchableDropdownField';
import {
  formatPurchaseItems,
  parsePurchaseItems,
} from '../../domain/purchaseItems';
import type { PurchaseItem } from '../../domain/purchaseItems';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface PurchaseItemsFieldProps {
  value: string | null;
  onChange: (next: string | null) => void;
  // Names already used on this board, commonest first — the same
  // pick-or-type treatment the payee field gets, and the reason the same
  // thing doesn't end up recorded under three spellings.
  nameOptions: string[];
  // Called with the row being typed into, so the page can scroll it clear of
  // the keyboard. Null on blur.
  onRevealRow?: (node: View | null) => void;
}

// What was in the bag: name/price pairs, typed by hand or filled from a
// receipt. The draft is the typed text and the stored string is the
// sanitized one (see domain/purchaseItems), so a comma typed into a name
// survives on screen until it is saved rather than vanishing as you type.
export function PurchaseItemsField({
  value,
  onChange,
  nameOptions,
  onRevealRow,
}: PurchaseItemsFieldProps) {
  const t = useT();
  const [draft, setDraft] = useState<PurchaseItem[]>(() => parsePurchaseItems(value));
  const rowRefs = useRef<(View | null)[]>([]);

  // The row being edited loads after this mounts, and a board switch can
  // swap it underneath — but only take the column back when it says
  // something this draft doesn't, or every keystroke would be undone by the
  // value it just produced.
  useEffect(() => {
    if (formatPurchaseItems(draft) !== value) setDraft(parsePurchaseItems(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next: PurchaseItem[]) => {
    setDraft(next);
    onChange(formatPurchaseItems(next));
  };

  const edit = (index: number, patch: Partial<PurchaseItem>) =>
    commit(draft.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const options = nameOptions.map((name, id) => ({ id, label: name }));

  return (
    <View style={styles.list}>
      {draft.map((item, index) => (
        <View
          key={index}
          ref={(node) => {
            rowRefs.current[index] = node;
          }}
        >
          <SearchableDropdownField
            hideLabel
            label={t('purchaseItems.namePickerTitle')}
            valueLabel={item.key}
            placeholder={t('purchaseItems.namePlaceholder')}
            searchPlaceholder={t('purchaseItems.nameSearchPlaceholder')}
            options={options}
            onSelect={(option) => edit(index, { key: option.label })}
            onUseText={(text) => edit(index, { key: text })}
            // Name, price and remove on one line; the list this opens still
            // unfolds under the whole row rather than inside the name's
            // column.
            renderField={(open, expanded) => (
              <View style={styles.row}>
                <Pressable style={styles.nameField} onPress={open}>
                  <Text
                    style={[styles.nameText, !item.key && styles.placeholder]}
                    numberOfLines={1}
                  >
                    {item.key || t('purchaseItems.namePlaceholder')}
                  </Text>
                  <Text style={[styles.chevron, expanded && styles.chevronOpen]}>
                    ▾
                  </Text>
                </Pressable>
                {/* Dollars, decimal point and all — deliberately not the
                    amount pad's digits-fill-from-the-right behaviour,
                    because an item price is copied off a receipt as
                    printed. */}
                <TextInput
                  style={styles.priceInput}
                  placeholder={t('purchaseItems.valuePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  keyboardAppearance="dark"
                  keyboardType="decimal-pad"
                  value={item.value}
                  onChangeText={(next) => edit(index, { value: next })}
                  onFocus={() => onRevealRow?.(rowRefs.current[index] ?? null)}
                  onBlur={() => onRevealRow?.(null)}
                />
                <Pressable
                  hitSlop={10}
                  onPress={() => commit(draft.filter((_, i) => i !== index))}
                >
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              </View>
            )}
          />
        </View>
      ))}
      <Pressable
        style={styles.addRow}
        onPress={() => commit([...draft, { key: '', value: '' }])}
      >
        <Text style={styles.addText}>{t('purchaseItems.add')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameField: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  nameText: { flex: 1, fontSize: 15, color: colors.text },
  placeholder: { color: colors.textMuted },
  chevron: { fontSize: 13, color: colors.textMuted, marginLeft: 4 },
  chevronOpen: { color: colors.accent },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: 'right',
  },
  remove: { fontSize: 15, color: colors.textMuted, paddingHorizontal: 2 },
  addRow: { paddingVertical: 8 },
  addText: { fontSize: 14, fontWeight: '600', color: colors.accent },
});
