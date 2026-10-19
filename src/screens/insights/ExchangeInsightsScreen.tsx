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
import { ExperimentalBanner } from '../../components/ui/ExperimentalBanner';
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
  amountCents,
  amountFromCents,
  formatAmountExpression,
} from '../../domain/amountExpression';
import type { AmountExpression } from '../../domain/amountExpression';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

function formatUnits(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const START_CENTS = 10000;

// A board of currencies rather than a From and a To: type into whichever
// one you are holding, and every other row is the same money said another
// way.
export function ExchangeInsightsScreen() {
  const t = useT();
  const { codes, focused, ready, add, remove, move, focus } = useFxCurrencies();
  const [expr, setExpr] = useState<AmountExpression>(
    amountFromCents(START_CENTS),
  );
  // Until a key is pressed, tapping a row reads as "what is 100 of this?"
  // rather than carrying the untouched starting amount across.
  const [typed, setTyped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  const latest = useLatestRates();
  const cents = amountCents(expr);

  // The typed amount is always denominated in the focused row, so moving the
  // focus — by tapping a row, or by deleting the one that had it — converts
  // it on the way. Null until the saved row lands: the currency restored
  // from last time is adopted, not converted into.
  const denomination = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const from = denomination.current;
    denomination.current = focused;
    if (from == null || from === focused) return;
    const rate = crossRate(latest.rates, from, focused);
    if (rate != null)
      setExpr((prev) => amountFromCents(Math.round(amountCents(prev) * rate)));
  }, [ready, focused, latest.rates]);

  const tapRow = (code: string) => {
    if (!typed || cents === 0) {
      denomination.current = code;
      setExpr(amountFromCents(START_CENTS));
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
  const shown = formatAmountExpression(expr, '') || formatUnits(0);

  const closeAdding = () => {
    setAdding(false);
    setQuery('');
  };

  return (
    <ScreenContainer scroll>
      <ExperimentalBanner />

      <View style={styles.head}>
        <Pressable onPress={latest.refresh} hitSlop={8}>
          <Text style={styles.muted} numberOfLines={1}>
            {latest.loading
              ? t('fx.updating')
              : latest.fetchedOn
                ? t('fx.updatedOn', { date: latest.fetchedOn })
                : t('fx.neverUpdated')}
          </Text>
        </Pressable>
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
              <Text style={styles.code}>{code}</Text>
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
                      style={[styles.removeKey, codes.length <= 1 && styles.off]}
                    >
                      ✕
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.valueColumn}>
                  <View style={styles.amountLine}>
                    <Text
                      style={styles.amount}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {isFocused
                        ? shown
                        : pairRate != null
                          ? formatUnits(Math.round(cents * pairRate))
                          : '—'}
                    </Text>
                    {isFocused ? <View style={styles.caret} /> : null}
                  </View>
                  <Text style={styles.name} numberOfLines={1}>
                    {t(currencyNameKey(code))} {currencySymbol(code)}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
        {available.length > 0 ? (
          <Pressable
            style={({ pressed }) => [
              styles.addRow,
              pressed && styles.addRowPressed,
            ]}
            onPress={() => setAdding(true)}
          >
            <Text style={styles.addText}>{t('fx.addCurrency')}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.pad}>
        <NumberPad
          value={expr}
          onChange={(next) => {
            setExpr(next);
            setTyped(true);
          }}
          submitLabel={editing ? t('common.done') : t('common.edit')}
          onSubmit={() => setEditing((on) => !on)}
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
  head: { paddingHorizontal: spacing.xs },
  board: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 92,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // A lift, not a colour: the caret already says which row takes the keys.
  rowFocused: { backgroundColor: '#2A2A2D' },
  flag: { fontSize: 38 },
  code: { fontSize: 22, fontWeight: '400', color: colors.text, letterSpacing: 0.5 },
  valueColumn: { flex: 1, alignItems: 'flex-end' },
  amountLine: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  amount: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  caret: {
    width: 2,
    height: 32,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  name: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  addRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addRowPressed: { backgroundColor: '#2A2A2D' },
  addText: { fontSize: 15, fontWeight: '600', color: colors.accent },
  editKeys: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  arrow: { fontSize: 18, color: colors.textMuted, paddingHorizontal: spacing.xs },
  off: { opacity: 0.3 },
  removeKey: {
    fontSize: 18,
    color: colors.negative,
    paddingHorizontal: spacing.xs,
  },
  pad: { marginBottom: spacing.lg },
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
