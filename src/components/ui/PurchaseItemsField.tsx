import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { itemPriceCents } from '../../domain/purchaseItems';
import type { PurchaseItem } from '../../domain/purchaseItems';
import { formatMoneyExact } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { BlinkingCaret } from './BlinkingCaret';

const SUGGESTION_COUNT = 6;

interface PurchaseItemsFieldProps {
  // The typed rows, blank ones included; the page saves them sanitized (see
  // domain/purchaseItems), so a price typed before its name isn't dropped.
  rows: PurchaseItem[];
  onChangeRows: (next: PurchaseItem[]) => void;
  // Names already used on this board, commonest first — offered as chips
  // under the row, so the same thing isn't recorded under three spellings.
  nameOptions: string[];
  // The spend's own amount, to say how much of it the items account for.
  totalCents?: number;
  // Prices are typed on the page's own pad, not the system keyboard: the
  // row it is typing into, what it shows there, and a tap to move it.
  activePrice: number | null;
  activePriceText: string;
  onPressPrice: (index: number) => void;
  // A name was focused, so the pad isn't typing a price any more.
  onFocusName: (node: View | null) => void;
  onBlurName: () => void;
  // Asked by the row (Return on a name, or a picked chip) to go on to the
  // next price.
  onNextPrice: (index: number, rows?: PurchaseItem[]) => void;
  // The pad's Next on a row with no name yet: its name, on the keyboard.
  // `seq` makes asking for the same row twice still count.
  nameToFocus: { index: number; seq: number } | null;
  // The row the pad moved to, so the page can scroll it above the pad.
  onRevealPrice: (node: View | null) => void;
}

// What was in the bag, typed like a receipt reads. Unfolded in the form
// under its row: price on the pad first, then the name on the keyboard.
export function PurchaseItemsField({
  rows,
  onChangeRows,
  nameOptions,
  totalCents,
  activePrice,
  activePriceText,
  onPressPrice,
  onFocusName,
  onBlurName,
  onNextPrice,
  nameToFocus,
  onRevealPrice,
}: PurchaseItemsFieldProps) {
  const t = useT();
  const [focusedName, setFocusedName] = useState<number | null>(null);
  const rowRefs = useRef<(View | null)[]>([]);
  const nameRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (nameToFocus) nameRefs.current[nameToFocus.index]?.focus();
  }, [nameToFocus]);

  useEffect(() => {
    if (activePrice != null) onRevealPrice(rowRefs.current[activePrice]);
  }, [activePrice, onRevealPrice]);

  const edit = (index: number, patch: Partial<PurchaseItem>) =>
    onChangeRows(
      rows.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );

  const remove = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChangeRows(next.length > 0 ? next : [{ key: '', value: '' }]);
  };

  const chipRow = focusedName ?? activePrice ?? rows.length - 1;
  const typed =
    focusedName != null
      ? (rows[focusedName]?.key.trim().toLowerCase() ?? '')
      : '';
  const listed = new Set(
    rows
      .filter((_, i) => i !== chipRow)
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
    const next = rows.map((item, i) =>
      i === chipRow ? { ...item, key: name } : item,
    );
    onChangeRows(next);
    nameRefs.current[chipRow]?.blur();
    onNextPrice(chipRow, next);
  };

  const listedCents = rows.reduce(
    (sum, item) => sum + (itemPriceCents(item.value) ?? 0),
    0,
  );

  return (
    <View style={styles.list}>
      {rows.map((item, index) => {
        const isLast = index === rows.length - 1;
        const typingPrice = activePrice === index;
        const priceText = typingPrice
          ? activePriceText
          : item.value
            ? formatMoneyExact(itemPriceCents(item.value) ?? 0)
            : '';
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
                // A price with no name isn't saved — say so in the row.
                placeholderTextColor={
                  item.value && !item.key.trim()
                    ? colors.negative
                    : colors.textMuted
                }
                keyboardAppearance="dark"
                autoCapitalize="sentences"
                returnKeyType="next"
                submitBehavior="blurAndSubmit"
                value={item.key}
                onChangeText={(key) => edit(index, { key })}
                onSubmitEditing={() => onNextPrice(index)}
                onFocus={() => {
                  setFocusedName(index);
                  onFocusName(rowRefs.current[index] ?? null);
                }}
                onBlur={() => {
                  setFocusedName((current) =>
                    current === index ? null : current,
                  );
                  onBlurName();
                }}
              />
              <Text style={styles.divider}>|</Text>
              <Pressable
                style={[styles.price, typingPrice && styles.priceActive]}
                onPress={() => {
                  nameRefs.current[index]?.blur();
                  onPressPrice(index);
                }}
                accessibilityLabel={t('purchaseItems.valuePlaceholder')}
              >
                <Text
                  style={[styles.priceText, !priceText && styles.placeholder]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {priceText || t('purchaseItems.valuePlaceholder')}
                </Text>
                {typingPrice ? (
                  <BlinkingCaret
                    style={styles.caret}
                    resetKey={activePriceText}
                  />
                ) : null}
              </Pressable>
              {isLast ? (
                <Pressable
                  hitSlop={10}
                  onPress={() => onNextPrice(index)}
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
  price: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  priceActive: { backgroundColor: colors.tint },
  priceText: { fontSize: 16, color: colors.text, flexShrink: 1 },
  placeholder: { color: colors.textMuted },
  caret: {
    width: 2,
    height: 18,
    borderRadius: 1,
    marginLeft: 2,
    backgroundColor: colors.accent,
  },
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
});
