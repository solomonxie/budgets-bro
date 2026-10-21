import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { DropdownOption } from '../../components/ui/DropdownField';
import { GuideSection } from '../../components/ui/GuideSection';
import { NumberPad } from '../../components/ui/NumberPad';
import { useFxCurrencies } from '../../hooks/useFxCurrencies';
import { useLatestRates } from '../../hooks/useLatestRates';
import { crossRate, FX_CURRENCIES } from '../../market/exchangeRates';
import {
  currencyFlag,
  currencyNameKey,
  currencySymbol,
} from '../../market/currencies';
import {
  EMPTY_AMOUNT,
  amountCents,
  formatAmountExpression,
  isEmptyAmount,
} from '../../domain/amountExpression';
import type { AmountExpression } from '../../domain/amountExpression';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Whole units throughout: cents on a converted figure are noise.
const SCALE = 100;
const START_CENTS = 100 * SCALE;

function formatUnits(cents: number): string {
  return Math.round(cents / SCALE).toLocaleString('en-US');
}

// "kr 1,000" reads; "kr1,000" doesn't. One-glyph symbols sit tight.
function symbolPrefix(code: string): string {
  const symbol = currencySymbol(code);
  return symbol.length > 1 && /\p{L}$/u.test(symbol) ? `${symbol} ` : symbol;
}

function unitsAmount(cents: number): AmountExpression {
  const units = Math.round(cents / SCALE);
  return { ...EMPTY_AMOUNT, digits: units ? String(units) : '' };
}

// A board of currencies rather than a From and a To: type into whichever
// one you are holding, and every other row is the same money said another
// way.
export function ExchangeInsightsScreen() {
  const t = useT();
  const { codes, focused, ready, add, remove, move, focus } = useFxCurrencies();
  const [expr, setExpr] = useState<AmountExpression>(EMPTY_AMOUNT);
  // Until a key is pressed the focused row shows 100 as a placeholder: the
  // first digit replaces it rather than appending, and tapping another row
  // asks "what is 100 of this?" instead of carrying an untouched amount.
  const [typed, setTyped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  const latest = useLatestRates();
  const cents = typed ? amountCents(expr, SCALE) : START_CENTS;

  // The typed amount is always denominated in the focused row, so moving the
  // focus — by tapping a row, or by deleting the one that had it — converts
  // it on the way. Null until the saved row lands: the currency restored
  // from last time is adopted, not converted into.
  const denomination = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const from = denomination.current;
    denomination.current = focused;
    if (from == null || from === focused || !typed) return;
    const rate = crossRate(latest.rates, from, focused);
    if (rate != null)
      setExpr((prev) => unitsAmount(amountCents(prev, SCALE) * rate));
  }, [ready, focused, latest.rates, typed]);

  const tapRow = (code: string) => {
    if (!typed || cents === 0) {
      denomination.current = code;
      setExpr(EMPTY_AMOUNT);
      setTyped(false);
    }
    focus(code);
  };

  const available = FX_CURRENCIES.filter((code) => !codes.includes(code));
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? available.filter(
        (code) =>
          code.toLowerCase().includes(needle) ||
          t(currencyNameKey(code)).toLowerCase().includes(needle),
      )
    : available;
  const focusedSymbol = symbolPrefix(focused);
  const shown = typed
    ? formatAmountExpression(expr, focusedSymbol, SCALE) || `${focusedSymbol}0`
    : `${focusedSymbol}${formatUnits(START_CENTS)}`;

  const closeAdding = () => {
    setAdding(false);
    setQuery('');
  };

  return (
    <ScreenContainer scroll>

      <View style={styles.head}>
        <Pressable onPress={latest.refresh} hitSlop={8} style={styles.status}>
          <Text style={styles.muted} numberOfLines={1}>
            {latest.loading
              ? t('fx.updating')
              : latest.fetchedOn
                ? t('fx.updatedOn', { date: latest.fetchedOn })
                : t('fx.neverUpdated')}
          </Text>
        </Pressable>
        <Pressable onPress={() => setEditing((on) => !on)} hitSlop={8}>
          <Text style={styles.link}>
            {editing ? t('common.done') : t('common.edit')}
          </Text>
        </Pressable>
        {available.length > 0 ? (
          <Pressable onPress={() => setAdding(true)} hitSlop={8}>
            <Text style={styles.link}>{t('fx.addCurrency')}</Text>
          </Pressable>
        ) : null}
      </View>
      {latest.error ? (
        <Text style={styles.error}>{t('fx.offline')}</Text>
      ) : null}

      <View style={styles.board}>
        {codes.map((code, i) => {
          const isFocused = code === focused;
          const pairRate = isFocused
            ? 1
            : crossRate(latest.rates, focused, code);
          return (
            <Pressable
              key={code}
              style={[
                styles.row,
                i > 0 && styles.rowDivider,
                isFocused && styles.rowFocused,
              ]}
              onPress={() => tapRow(code)}
            >
              <Text style={styles.flag}>{currencyFlag(code)}</Text>
              <View style={styles.label}>
                <Text style={styles.code}>{code}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {t(currencyNameKey(code))}
                </Text>
              </View>
              {editing ? (
                <View style={styles.editKeys}>
                  <Pressable
                    hitSlop={8}
                    disabled={i === 0}
                    onPress={() => move(code, -1)}
                  >
                    <Text style={[styles.arrow, i === 0 && styles.off]}>↑</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    disabled={i === codes.length - 1}
                    onPress={() => move(code, 1)}
                  >
                    <Text
                      style={[
                        styles.arrow,
                        i === codes.length - 1 && styles.off,
                      ]}
                    >
                      ↓
                    </Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    disabled={codes.length <= 1}
                    onPress={() => remove(code)}
                  >
                    <Text
                      style={[
                        styles.removeKey,
                        codes.length <= 1 && styles.off,
                      ]}
                    >
                      ✕
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.amountLine}>
                  <Text
                    style={[
                      styles.amount,
                      isFocused && !typed && styles.placeholder,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isFocused
                      ? shown
                      : pairRate != null
                        ? `${symbolPrefix(code)}${formatUnits(Math.round(cents * pairRate))}`
                        : '—'}
                  </Text>
                  {isFocused ? <View style={styles.caret} /> : null}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.pad}>
        <NumberPad
          value={typed ? expr : EMPTY_AMOUNT}
          onChange={(next) => {
            setExpr(next);
            setTyped(!isEmptyAmount(next));
          }}
          scale={SCALE}
          submitLabel="="
          onSubmit={() => {}}
          equalsAsSubmit
          compact
        />
      </View>

      <GuideSection heading={t('fx.sourceHeading')} body={t('fx.sourceBody')} />

      <Modal
        visible={adding}
        transparent
        animationType="slide"
        onRequestClose={closeAdding}
      >
        <BottomSheet
          title={t('fx.addCurrencyTitle')}
          onClose={closeAdding}
          listHeight={360}
          stickyContent={
            <TextInput
              style={styles.search}
              placeholder={t('fx.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardAppearance="dark"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (!matches[0]) return;
                add(matches[0]);
                closeAdding();
              }}
            />
          }
        >
          {available.length === 0 ? (
            <Text style={styles.muted}>{t('fx.allAdded')}</Text>
          ) : (
            matches.map((code) => (
              <DropdownOption
                key={code}
                label={`${currencyFlag(code)}  ${code} · ${t(currencyNameKey(code))}`}
                onPress={() => {
                  add(code);
                  closeAdding();
                }}
              />
            ))
          )}
        </BottomSheet>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  status: { flex: 1 },
  link: { fontSize: 14, fontWeight: '700', color: colors.accent },
  board: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // A lift, not a colour: the caret already says which row takes the keys.
  rowFocused: { backgroundColor: '#2A2A2D' },
  flag: { fontSize: 26 },
  code: { fontSize: 17, fontWeight: '500', color: colors.text },
  label: { flexShrink: 0 },
  amountLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  amount: {
    fontSize: 24,
    fontWeight: '300',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  placeholder: { color: colors.textMuted },
  caret: {
    width: 2,
    height: 24,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  name: { fontSize: 11, color: colors.textMuted },
  editKeys: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  arrow: {
    fontSize: 18,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  off: { opacity: 0.3 },
  removeKey: {
    fontSize: 18,
    color: colors.negative,
    paddingHorizontal: spacing.xs,
  },
  pad: { marginTop: spacing.lg, marginBottom: spacing.lg },
  search: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  muted: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 12, color: colors.negative },
});
