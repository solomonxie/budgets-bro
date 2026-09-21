import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { DropdownField, DropdownOption } from '../../components/ui/DropdownField';
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';
import { GuideSection } from '../../components/ui/GuideSection';
import { SeriesLineChart } from '../../components/ui/SeriesLineChart';
import { useExchangeRates } from '../../hooks/useExchangeRates';
import { FX_CURRENCIES } from '../../market/exchangeRates';
import { downsample, fxStats, sliceRecent } from '../../market/fxStats';
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

// A converter with the history behind it. The number you came for is at the
// top; underneath is the thing a converter never tells you — whether today
// is a good day to move money, which only five years of the same line can
// answer.
export function ExchangeInsightsScreen() {
  const t = useT();
  const [from, setFrom] = useState('CAD');
  const [to, setTo] = useState('CNY');
  const [amount, setAmount] = useState('100');
  const [windowDays, setWindowDays] = useState<number>(365 * 5);
  const { points, fetchedOn, loading, error, refresh } = useExchangeRates(from, to);

  const windowed = useMemo(
    () => sliceRecent(points, windowDays),
    [points, windowDays],
  );
  const stats = useMemo(() => fxStats(windowed), [windowed]);
  const charted = useMemo(
    () => downsample(windowed, CHART_POINTS),
    [windowed],
  );

  const rate = stats.latest?.rate ?? 0;
  const amountNumber = Number.parseFloat(amount.replace(/[,\s$¥￥€£]/g, ''));
  const converted = Number.isFinite(amountNumber) ? amountNumber * rate : 0;

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <ScreenContainer scroll>
      <ExpandingFieldGroup>
        <GuideSection
          heading={t('fx.guideHeading')}
          body={t('fx.guideBody')}
        />

        <Card title={t('fx.converterHeading')}>
          <TextField
            label={t('fx.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <DropdownField compact label={t('fx.from')} valueLabel={from}>
            {(close) => (
              <>
                {FX_CURRENCIES.map((code) => (
                  <DropdownOption
                    key={code}
                    label={code}
                    selected={from === code}
                    onPress={() => {
                      setFrom(code);
                      close();
                    }}
                  />
                ))}
              </>
            )}
          </DropdownField>
          <DropdownField compact label={t('fx.to')} valueLabel={to}>
            {(close) => (
              <>
                {FX_CURRENCIES.map((code) => (
                  <DropdownOption
                    key={code}
                    label={code}
                    selected={to === code}
                    onPress={() => {
                      setTo(code);
                      close();
                    }}
                  />
                ))}
              </>
            )}
          </DropdownField>
          <Pressable onPress={swap} hitSlop={8}>
            <Text style={styles.link}>{t('fx.swap')}</Text>
          </Pressable>

          {rate > 0 ? (
            <>
              <Text style={styles.converted}>
                {converted.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{' '}
                {to}
              </Text>
              <Text style={styles.rateLine}>
                {t('fx.rateLine', {
                  from,
                  rate: formatRate(rate),
                  to,
                })}
              </Text>
            </>
          ) : (
            <Text style={styles.muted}>
              {t(from === to ? 'fx.samePair' : 'fx.noRateYet')}
            </Text>
          )}
          <Pressable onPress={refresh} hitSlop={8}>
            <Text style={styles.muted}>
              {loading
                ? t('fx.updating')
                : fetchedOn
                  ? t('fx.updatedOn', { date: fetchedOn })
                  : t('fx.neverUpdated')}
            </Text>
          </Pressable>
          {error ? <Text style={styles.error}>{t('fx.offline')}</Text> : null}
        </Card>

        {charted.length > 1 ? (
          <Card title={t('fx.trendHeading', { from, to })}>
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
        ) : null}

        <GuideSection
          heading={t('fx.sourceHeading')}
          body={t('fx.sourceBody')}
        />
      </ExpandingFieldGroup>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 13, fontWeight: '700', color: colors.accent },
  converted: { fontSize: 28, fontWeight: '700', color: colors.text },
  rateLine: { fontSize: 13, color: colors.textMuted },
  muted: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 12, color: colors.negative },
  chips: { flexDirection: 'row', gap: spacing.sm },
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
