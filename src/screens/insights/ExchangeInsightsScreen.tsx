import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ExperimentalBanner } from '../../components/ui/ExperimentalBanner';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Card } from '../../components/ui/Card';
import { DropdownOption } from '../../components/ui/DropdownField';
import { GuideSection } from '../../components/ui/GuideSection';
import { NumberPad } from '../../components/ui/NumberPad';
import { ResultRow } from '../../components/ui/ResultRow';
import { SeriesLineChart } from '../../components/ui/SeriesLineChart';
import { useExchangeRates } from '../../hooks/useExchangeRates';
import { useFxCurrencies } from '../../hooks/useFxCurrencies';
import { useLatestRates } from '../../hooks/useLatestRates';
import { crossRate, FX_CURRENCIES } from '../../market/exchangeRates';
import {
  currencyFlag,
  currencyNameKey,
  currencySymbol,
} from '../../market/currencies';
import { downsample, fxStats, sliceRecent } from '../../market/fxStats';
import {
  amountCents,
  amountFromCents,
  formatAmountExpression,
} from '../../domain/amountExpression';
import type { AmountExpression } from '../../domain/amountExpression';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const WINDOWS = [
  { days: 30, labelKey: 'fx.window1m' },
  { days: 365, labelKey: 'fx.window1y' },
  { days: 365 * 5, labelKey: 'fx.window5y' },
] as const;

const CHART_POINTS = 180;

function formatRate(rate: number): string {
  return rate >= 100 ? rate.toFixed(2) : rate.toPrecision(5);
}

function formatUnits(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// A board of currencies rather than a From and a To: type into whichever
// one you are holding, and every other row is the same money said another
// way. Underneath is the thing a converter never tells you — whether today
// is a good day to move it, which only five years of the same line can
// answer.
export function ExchangeInsightsScreen() {
  const t = useT();
  const { codes, focused, ready, add, remove, move, focus } = useFxCurrencies();
  const [expr, setExpr] = useState<AmountExpression>(amountFromCents(10000));
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [against, setAgainst] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number>(365 * 5);

  const latest = useLatestRates();
  const cents = amountCents(expr);

  // The typed amount is always denominated in the focused row, so moving the
  // focus — by tapping a row, or by deleting the one that had it — converts
  // it on the way. One rule, rather than one per way the focus can move.
  // Null until the saved row lands: the currency restored from last time is
  // adopted, not converted into, or a reopened page would multiply the
  // starting amount by whatever pair the defaults happened to name.
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

  const others = codes.filter((code) => code !== focused);
  const pairTo = against && others.includes(against) ? against : others[0];
  const series = useExchangeRates(focused, pairTo ?? focused);

  const windowed = useMemo(
    () => sliceRecent(series.points, windowDays),
    [series.points, windowDays],
  );
  const stats = useMemo(() => fxStats(windowed), [windowed]);
  const charted = useMemo(
    () => downsample(windowed, CHART_POINTS),
    [windowed],
  );
  const available = FX_CURRENCIES.filter((code) => !codes.includes(code));

  const rate = stats.latest?.rate ?? 0;
  const typed = formatAmountExpression(expr, '') || formatUnits(0);

  const refresh = () => {
    latest.refresh();
    series.refresh();
  };

  return (
    <ScreenContainer scroll>
      <ExperimentalBanner />
      <GuideSection heading={t('fx.guideHeading')} body={t('fx.guideBody')} />

      <Card>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{t('fx.converterHeading')}</Text>
          <Pressable onPress={() => setEditing((on) => !on)} hitSlop={8}>
            <Text style={styles.link}>
              {editing ? t('common.done') : t('common.edit')}
            </Text>
          </Pressable>
        </View>
        {editing ? null : (
          <Text style={styles.muted}>{t('fx.converterHint')}</Text>
        )}

        {codes.map((code, i) => {
          const isFocused = code === focused;
          const pairRate = isFocused ? 1 : crossRate(latest.rates, focused, code);
          return (
            <Pressable
              key={code}
              style={[styles.row, isFocused && styles.rowFocused]}
              onPress={() => focus(code)}
            >
              <Text style={styles.flag}>{currencyFlag(code)}</Text>
              <Text style={[styles.code, isFocused && styles.codeFocused]}>
                {code}
              </Text>
              {editing ? (
                <>
                  <Text style={styles.editName} numberOfLines={1}>
                    {t(currencyNameKey(code))}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    disabled={i === 0}
                    onPress={() => move(code, -1)}
                  >
                    <Text style={[styles.arrow, i === 0 && styles.arrowOff]}>
                      ↑
                    </Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    disabled={i === codes.length - 1}
                    onPress={() => move(code, 1)}
                  >
                    <Text
                      style={[
                        styles.arrow,
                        i === codes.length - 1 && styles.arrowOff,
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
                        codes.length <= 1 && styles.arrowOff,
                      ]}
                    >
                      ✕
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.valueColumn}>
                  <Text
                    style={[styles.amount, isFocused && styles.amountFocused]}
                    numberOfLines={1}
                  >
                    {isFocused
                      ? typed
                      : pairRate != null
                        ? formatUnits(Math.round(cents * pairRate))
                        : '—'}
                  </Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {t(currencyNameKey(code))} {currencySymbol(code)}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}

        <Pressable onPress={refresh} hitSlop={8}>
          <Text style={styles.muted}>
            {latest.loading
              ? t('fx.updating')
              : latest.fetchedOn
                ? t('fx.updatedOn', { date: latest.fetchedOn })
                : t('fx.neverUpdated')}
          </Text>
        </Pressable>
        {latest.error ? (
          <Text style={styles.error}>{t('fx.offline')}</Text>
        ) : null}
      </Card>

      <View style={styles.pad}>
        <NumberPad
          value={expr}
          onChange={setExpr}
          submitLabel={t('fx.addCurrency')}
          onSubmit={() => setAdding(true)}
        />
      </View>

      {pairTo == null ? (
        <Text style={styles.muted}>{t('fx.addSecondHint')}</Text>
      ) : charted.length > 1 ? (
        <Card title={t('fx.trendHeading', { from: focused, to: pairTo })}>
          {others.length > 1 ? (
            <View style={styles.chips}>
              <Text style={styles.chipLabel}>{t('fx.against')}</Text>
              {others.map((code) => (
                <Pressable
                  key={code}
                  style={[styles.chip, pairTo === code && styles.chipOn]}
                  onPress={() => setAgainst(code)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      pairTo === code && styles.chipTextOn,
                    ]}
                  >
                    {code}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.rateLine}>
            {t('fx.rateLine', {
              from: focused,
              rate: formatRate(rate),
              to: pairTo,
            })}
          </Text>
          <View style={styles.chips}>
            {WINDOWS.map((w) => (
              <Pressable
                key={w.days}
                style={[styles.chip, windowDays === w.days && styles.chipOn]}
                onPress={() => setWindowDays(w.days)}
              >
                <Text
                  style={[
                    styles.chipText,
                    windowDays === w.days && styles.chipTextOn,
                  ]}
                >
                  {t(w.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
          <SeriesLineChart
            points={charted.map((p) => ({ label: p.date, value: p.rate }))}
            formatValue={formatRate}
          />
          <ResultRow
            label={t('fx.change')}
            value={`${stats.changeFraction >= 0 ? '+' : ''}${(stats.changeFraction * 100).toFixed(1)}%`}
            tone={stats.changeFraction >= 0 ? 'positive' : 'negative'}
          />
          <ResultRow
            label={t('fx.high')}
            value={`${formatRate(stats.high?.rate ?? 0)} · ${stats.high?.date ?? ''}`}
          />
          <ResultRow
            label={t('fx.low')}
            value={`${formatRate(stats.low?.rate ?? 0)} · ${stats.low?.date ?? ''}`}
          />
          <ResultRow
            label={t('fx.average')}
            value={formatRate(stats.averageRate)}
            tone="muted"
          />
          <ResultRow
            label={t('fx.versusAverage')}
            value={`${rate >= stats.averageRate ? '+' : ''}${(((rate - stats.averageRate) / (stats.averageRate || 1)) * 100).toFixed(1)}%`}
            tone={rate >= stats.averageRate ? 'positive' : 'negative'}
            hint={t('fx.versusAverageHint')}
          />
        </Card>
      ) : (
        <Text style={styles.muted}>{t('fx.noRateYet')}</Text>
      )}

      <GuideSection heading={t('fx.sourceHeading')} body={t('fx.sourceBody')} />

      <Modal
        visible={adding}
        transparent
        animationType="slide"
        onRequestClose={() => setAdding(false)}
      >
        <BottomSheet
          title={t('fx.addCurrencyTitle')}
          onClose={() => setAdding(false)}
        >
          {available.length === 0 ? (
            <Text style={styles.muted}>{t('fx.allAdded')}</Text>
          ) : (
            available.map((code) => (
              <DropdownOption
                key={code}
                label={`${currencyFlag(code)}  ${code} · ${t(currencyNameKey(code))}`}
                onPress={() => {
                  add(code);
                  setAdding(false);
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
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  link: { fontSize: 13, fontWeight: '700', color: colors.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  // The row being typed into is the only lit one — the caret is the
  // highlight, since there is no system keyboard here to own the focus.
  rowFocused: { backgroundColor: colors.tint },
  flag: { fontSize: 24 },
  code: { fontSize: 17, fontWeight: '600', color: colors.text },
  codeFocused: { color: colors.accent },
  editName: { flex: 1, fontSize: 13, color: colors.textMuted },
  valueColumn: { flex: 1, alignItems: 'flex-end' },
  amount: { fontSize: 24, fontWeight: '600', color: colors.text },
  amountFocused: { color: colors.accent },
  name: { fontSize: 11, color: colors.textMuted },
  arrow: { fontSize: 16, color: colors.textMuted, paddingHorizontal: spacing.xs },
  arrowOff: { opacity: 0.3 },
  removeKey: {
    fontSize: 16,
    color: colors.negative,
    paddingHorizontal: spacing.xs,
  },
  pad: { marginBottom: spacing.md },
  rateLine: { fontSize: 13, color: colors.textMuted },
  muted: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 12, color: colors.negative },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  chipLabel: { fontSize: 12, color: colors.textMuted },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  chipOn: { borderColor: colors.accent },
  chipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  chipTextOn: { color: colors.accent },
});
