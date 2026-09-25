import { useEffect, useRef, useState } from 'react';
import {
  InputAccessoryView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatPurchaseItems,
  itemPriceCents,
  parsePurchaseItems,
} from '../../domain/purchaseItems';
import type { PurchaseItem } from '../../domain/purchaseItems';
import { formatMoneyExact } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const SUGGESTION_COUNT = 6;
const PRICE_ACCESSORY_ID = 'purchaseItemPrice';

interface PurchaseItemsFieldProps {
  value: string | null;
  onChange: (next: string | null) => void;
  // Names already used on this board, commonest first — offered as chips
  // under the name being typed, so the same thing isn't recorded under
  // three spellings.
  nameOptions: string[];
  // The spend's own amount, to say how much of it the items account for.
  totalCents?: number;
  // Called with the row being typed into, so the page can scroll it clear of
  // the keyboard. Null on blur.
  onRevealRow?: (node: View | null) => void;
}

// What was in the bag, typed like a receipt reads: name, price, next line.
// Always open — one row to start, + at the end of the last for another. The
// draft is the typed text, blank rows included; the stored string is the
// sanitized one (see domain/purchaseItems), so a comma typed into a name
// survives on screen until it is saved.
export function PurchaseItemsField({
  value,
  onChange,
  nameOptions,
  totalCents,
  onRevealRow,
}: PurchaseItemsFieldProps) {
  const t = useT();
  const [draft, setDraft] = useState<PurchaseItem[]>(() =>
    withRow(parsePurchaseItems(value)),
  );
  const [focusedName, setFocusedName] = useState<number | null>(null);
  const rowRefs = useRef<(View | null)[]>([]);
  const nameRefs = useRef<(TextInput | null)[]>([]);
  const priceRefs = useRef<(TextInput | null)[]>([]);
  const focusedPrice = useRef(0);
  const pendingFocus = useRef<{
    index: number;
    field: 'name' | 'price';
  } | null>(null);

  // The row being edited loads after this mounts — only take the column back
  // when it says something this draft doesn't, or every keystroke would be
  // undone by the value it just produced.
  useEffect(() => {
    if (formatPurchaseItems(draft) !== value)
      setDraft(withRow(parsePurchaseItems(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Focus moves after the render that creates the row it moves to.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    (target.field === 'name' ? nameRefs : priceRefs).current[
      target.index
    ]?.focus();
  });

  const rows = draft;

  const commit = (next: PurchaseItem[]) => {
    setDraft(withRow(next));
    onChange(formatPurchaseItems(next));
  };

  const edit = (index: number, patch: Partial<PurchaseItem>) =>
    commit(rows.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const remove = (index: number) => commit(rows.filter((_, i) => i !== index));

  // An empty last row is already the one to type into.
  const addRow = () => {
    const last = rows[rows.length - 1];
    const index =
      last && !last.key && !last.value ? rows.length - 1 : rows.length;
    if (index === rows.length) setDraft([...rows, { key: '', value: '' }]);
    pendingFocus.current = { index, field: 'name' };
    nameRefs.current[index]?.focus();
  };

  // Past names are on show from the start, under the row being typed or
  // else the last one: a tap fills that row, or adds one if it already has
  // a name.
  const chipRow = focusedName ?? rows.length - 1;
  const typed =
    focusedName != null
      ? (rows[focusedName]?.key.trim().toLowerCase() ?? '')
      : '';
  const listed = new Set(
    rows
      .filter((_, i) => i !== focusedName)
      .map((item) => item.key.trim().toLowerCase()),
  );
  const suggestions = nameOptions
    .filter((name) => {
      const lower = name.toLowerCase();
      return (
        lower !== typed &&
        !listed.has(lower) &&
        (typed === '' || lower.includes(typed))
      );
    })
    .slice(0, SUGGESTION_COUNT);

  const pickName = (name: string) => {
    const target = rows[chipRow];
    if (focusedName != null || !target?.key.trim()) {
      edit(chipRow, { key: name });
      pendingFocus.current = { index: chipRow, field: 'price' };
    } else {
      commit([...rows, { key: name, value: '' }]);
      pendingFocus.current = { index: rows.length, field: 'price' };
    }
  };

  const listedCents = rows.reduce(
    (sum, item) => sum + (itemPriceCents(item.value) ?? 0),
    0,
  );

  return (
    <View style={styles.list}>
      {rows.map((item, index) => {
        const isLast = index === rows.length - 1;
        // The chips sit under the row they fill, inside what gets scrolled
        // clear of the keyboard — below the last row they were revealed
        // with nothing and stayed under the keys.
        return (
          <View
            key={index}
            style={styles.list}
            ref={(node) => {
              rowRefs.current[index] = node;
            }}
          >
            <View style={styles.row}>
              <TextInput
                ref={(node) => {
                  nameRefs.current[index] = node;
                }}
                style={styles.nameInput}
                placeholder={t('purchaseItems.namePlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardAppearance="dark"
                autoCapitalize="sentences"
                returnKeyType="next"
                submitBehavior="submit"
                value={item.key}
                onChangeText={(key) => edit(index, { key })}
                onSubmitEditing={() => priceRefs.current[index]?.focus()}
                onFocus={() => {
                  setFocusedName(index);
                  onRevealRow?.(rowRefs.current[index] ?? null);
                }}
                onBlur={() => {
                  setFocusedName((current) =>
                    current === index ? null : current,
                  );
                  onRevealRow?.(null);
                }}
              />
              <Text style={styles.divider}>|</Text>
              {/* Dollars and a decimal point, copied off a receipt as
                  printed. The decimal pad has no return key; the bar above
                  it has Next instead. */}
              <TextInput
                ref={(node) => {
                  priceRefs.current[index] = node;
                }}
                style={styles.priceInput}
                placeholder={t('purchaseItems.valuePlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardAppearance="dark"
                keyboardType="decimal-pad"
                inputAccessoryViewID={PRICE_ACCESSORY_ID}
                value={item.value}
                onChangeText={(next) => edit(index, { value: next })}
                onFocus={() => {
                  focusedPrice.current = index;
                  onRevealRow?.(rowRefs.current[index] ?? null);
                }}
                onBlur={() => onRevealRow?.(null)}
              />
              {isLast ? (
                <Pressable
                  hitSlop={10}
                  onPress={addRow}
                  accessibilityLabel={t('purchaseItems.add')}
                >
                  <Text style={styles.add}>+</Text>
                </Pressable>
              ) : (
                <Pressable
                  hitSlop={10}
                  onPress={() => remove(index)}
                  accessibilityLabel={t('purchaseItems.remove')}
                >
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              )}
            </View>
            {index === chipRow && suggestions.length > 0 ? (
              <View style={styles.chips}>
                {suggestions.map((name) => (
                  <Pressable
                    key={name}
                    style={styles.chip}
                    onPress={() => pickName(name)}
                  >
                    <Text style={styles.chipText} numberOfLines={1}>
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      {listedCents > 0 ? (
        <Text style={styles.total}>
          {totalCents
            ? t('purchaseItems.listedOfTotal', {
                listed: formatMoneyExact(listedCents),
                total: formatMoneyExact(totalCents),
              })
            : t('purchaseItems.listed', {
                listed: formatMoneyExact(listedCents),
              })}
        </Text>
      ) : null}
      <InputAccessoryView nativeID={PRICE_ACCESSORY_ID}>
        <View style={styles.accessory}>
          <Pressable
            hitSlop={10}
            onPress={() => {
              const index = focusedPrice.current + 1;
              if (index >= rows.length) return addRow();
              nameRefs.current[index]?.focus();
            }}
          >
            <Text style={styles.accessoryText}>
              {t('purchaseItems.nextRow')}
            </Text>
          </Pressable>
        </View>
      </InputAccessoryView>
    </View>
  );
}

// Bare text on the card, like the rows around it — a | between name and
// price, no boxes.
const field = {
  paddingVertical: 10,
  paddingHorizontal: 4,
  fontSize: 16,
  color: colors.text,
} as const;

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: { ...field, flex: 2 },
  priceInput: { ...field, flex: 1, textAlign: 'right' },
  divider: { fontSize: 16, color: colors.border },
  remove: {
    fontSize: 16,
    color: colors.textMuted,
    width: 18,
    textAlign: 'center',
  },
  add: {
    fontSize: 24,
    lineHeight: 26,
    color: colors.accent,
    width: 18,
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    maxWidth: '100%',
  },
  chipText: { fontSize: 14, color: colors.text },
  total: { fontSize: 13, color: colors.textMuted, textAlign: 'right' },
  accessory: {
    alignItems: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  accessoryText: { fontSize: 16, fontWeight: '600', color: colors.accent },
});

function withRow(items: PurchaseItem[]): PurchaseItem[] {
  return items.length > 0 ? items : [{ key: '', value: '' }];
}
