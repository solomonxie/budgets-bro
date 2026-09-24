import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
// There is always one blank row at the end to type the next item into — no
// "add" button, no picker to open first. The draft is the typed text and the
// stored string is the sanitized one (see domain/purchaseItems), so a comma
// typed into a name survives on screen until it is saved.
export function PurchaseItemsField({
  value,
  onChange,
  nameOptions,
  totalCents,
  onRevealRow,
}: PurchaseItemsFieldProps) {
  const t = useT();
  const [draft, setDraft] = useState<PurchaseItem[]>(() =>
    parsePurchaseItems(value),
  );
  const [focusedName, setFocusedName] = useState<number | null>(null);
  const rowRefs = useRef<(View | null)[]>([]);
  const nameRefs = useRef<(TextInput | null)[]>([]);
  const priceRefs = useRef<(TextInput | null)[]>([]);
  const pendingFocus = useRef<{
    index: number;
    field: 'name' | 'price';
  } | null>(null);

  // The row being edited loads after this mounts — only take the column back
  // when it says something this draft doesn't, or every keystroke would be
  // undone by the value it just produced.
  useEffect(() => {
    if (formatPurchaseItems(draft) !== value)
      setDraft(parsePurchaseItems(value));
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

  const rows = [...draft, { key: '', value: '' }];

  const commit = (next: PurchaseItem[]) => {
    setDraft(next);
    onChange(formatPurchaseItems(next));
  };

  const edit = (index: number, patch: Partial<PurchaseItem>) => {
    const next = rows.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    // The trailing blank only becomes an item once something is typed in it.
    commit(
      next.filter((item, i) => i < next.length - 1 || item.key || item.value),
    );
  };

  const remove = (index: number) => commit(draft.filter((_, i) => i !== index));

  const typed =
    focusedName != null
      ? (rows[focusedName]?.key.trim().toLowerCase() ?? '')
      : '';
  const suggestions =
    focusedName == null
      ? []
      : nameOptions
          .filter((name) => {
            const lower = name.toLowerCase();
            return lower !== typed && (typed === '' || lower.includes(typed));
          })
          .slice(0, SUGGESTION_COUNT);

  const listedCents = draft.reduce(
    (sum, item) => sum + (itemPriceCents(item.value) ?? 0),
    0,
  );

  return (
    <View style={styles.list}>
      {rows.map((item, index) => {
        const isBlank = index === rows.length - 1;
        return (
          <View
            key={index}
            style={styles.row}
            ref={(node) => {
              rowRefs.current[index] = node;
            }}
          >
            <TextInput
              ref={(node) => {
                nameRefs.current[index] = node;
              }}
              style={styles.nameInput}
              placeholder={t(
                isBlank && draft.length > 0
                  ? 'purchaseItems.nextPlaceholder'
                  : 'purchaseItems.namePlaceholder',
              )}
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
            {/* Dollars and a decimal point, copied off a receipt as printed —
                not the amount pad's digits-fill-from-the-right. This keyboard
                has a return key, which takes you to the next line. */}
            <TextInput
              ref={(node) => {
                priceRefs.current[index] = node;
              }}
              style={styles.priceInput}
              placeholder={t('purchaseItems.valuePlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardAppearance="dark"
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
              submitBehavior="submit"
              value={item.value}
              onChangeText={(next) => edit(index, { value: next })}
              onSubmitEditing={() => {
                pendingFocus.current = { index: index + 1, field: 'name' };
                nameRefs.current[index + 1]?.focus();
              }}
              onFocus={() => onRevealRow?.(rowRefs.current[index] ?? null)}
              onBlur={() => onRevealRow?.(null)}
            />
            {isBlank ? (
              <View style={styles.removeSpacer} />
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
        );
      })}
      {suggestions.length > 0 ? (
        <View style={styles.chips}>
          {suggestions.map((name) => (
            <Pressable
              key={name}
              style={styles.chip}
              onPress={() => {
                if (focusedName == null) return;
                edit(focusedName, { key: name });
                pendingFocus.current = { index: focusedName, field: 'price' };
              }}
            >
              <Text style={styles.chipText} numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
    </View>
  );
}

const field = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  paddingVertical: 12,
  paddingHorizontal: 12,
  fontSize: 17,
  color: colors.text,
  backgroundColor: colors.background,
} as const;

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: { ...field, flex: 2 },
  priceInput: { ...field, flex: 1, textAlign: 'right' },
  remove: {
    fontSize: 16,
    color: colors.textMuted,
    width: 18,
    textAlign: 'center',
  },
  removeSpacer: { width: 18 },
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
});
