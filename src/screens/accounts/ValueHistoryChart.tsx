import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Polygon, Polyline } from 'react-native-svg';
import { buildGrowthSeries, projectGrowthOntoPeriods } from '../../domain/investmentGrowth';
import { currentMonth, currentYear, formatMonthShort, monthsBetween, yearsBetween } from '../../domain/month';
import { formatMoney, formatMoneyCompact } from '../../domain/money';
import { useI18n, localeTag } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const CHART_HEIGHT = 120;
const Y_AXIS_WIDTH = 44;
// How much of the trend fits without scrolling, and how tight a step can
// get before the x labels collide — a 'YYYY' label needs more room than
// 'Jan', and a yearly trend has far fewer steps to spend width on.
const STEP_SIZING = {
  month: { visible: 12, minWidth: 28 },
  year: { visible: 8, minWidth: 44 },
};

export type ValueHistoryChartMode = 'stacked' | 'single';
export type ValueHistoryChartInterval = 'month' | 'year';

// A manually-logged value history (account_value_history), resampled onto
// a real calendar (months, or years — see `interval`) and drawn as a
// scrollable area chart — same shape/interaction as InsightsScreen's
// category-trend chart (a fixed window visible by default, drag to see
// further back). Shared by every account kind that logs one of these:
// - 'stacked': deposited (net real transactions) as the base band, gain
//   stacked on top — savings/cash/tracking accounts (see
//   domain/investmentGrowth.ts).
// - 'single': one band, the logged value itself — a mortgage's home
//   value, which has no "deposits" concept to split out.
export function ValueHistoryChart({
  history,
  transactions = [],
  mode,
  interval = 'month',
}: {
  history: { valueCents: number; effectiveDate: string }[];
  transactions?: { amountCents: number; date: string }[];
  mode: ValueHistoryChartMode;
  // 'year': a home value is appraised/estimated once in a while, not
  // monthly — month steps just stretch the same number into a flat run of
  // identical points. Everything else logs often enough to be worth months.
  interval?: ValueHistoryChartInterval;
}) {
  const { t, language } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const series = useMemo(
    () => buildGrowthSeries(history, mode === 'stacked' ? transactions : []),
    [history, transactions, mode],
  );
  const latest = series.at(-1) ?? null;
  const gainColor = latest != null && latest.gainCents < 0 ? colors.negative : colors.positive;
  const gainPct = latest != null && latest.depositedCents > 0 ? (latest.gainCents / latest.depositedCents) * 100 : null;

  const byYear = interval === 'year';
  const periods = useMemo(() => {
    if (series.length === 0) return [];
    const first = series[0].date;
    return byYear ? yearsBetween(first.slice(0, 4), currentYear()) : monthsBetween(first.slice(0, 7), currentMonth());
  }, [series, byYear]);
  const projected = useMemo(() => projectGrowthOntoPeriods(series, periods), [series, periods]);

  const sizing = STEP_SIZING[interval];
  const fittedWidth = Math.max(200, windowWidth - spacing.md * 4 - Y_AXIS_WIDTH);
  const stepWidth = Math.max(sizing.minWidth, fittedWidth / sizing.visible);
  const chartWidth = Math.max(fittedWidth, periods.length * stepWidth);
  const pointX = (i: number) => (periods.length > 1 ? (i / (periods.length - 1)) * chartWidth : chartWidth / 2);

  const maxValue = Math.max(1, ...projected.map((p) => (p ? Math.max(p.totalCents, p.depositedCents) : 0)));
  const pointY = (v: number) => CHART_HEIGHT - (v / maxValue) * (CHART_HEIGHT - 8) - 4;
  const yTicks = [maxValue, maxValue / 2, 0];

  const depositedTops = projected.map((p) => (p ? Math.max(0, p.depositedCents) : 0));
  const gainTops = projected.map((p, i) => (p ? depositedTops[i] + Math.max(0, p.gainCents) : depositedTops[i]));
  const totalLine = projected.map((p, i) => `${pointX(i)},${pointY(p ? p.totalCents : 0)}`).join(' ');
  const depositedBand = [
    ...periods.map((_, i) => `${pointX(i)},${pointY(depositedTops[i])}`),
    ...periods.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${pointY(0)}`),
  ].join(' ');
  const gainBand = [
    ...periods.map((_, i) => `${pointX(i)},${pointY(gainTops[i])}`),
    ...periods.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${pointY(depositedTops[arr.length - 1 - i])}`),
  ].join(' ');
  const singleBand = [
    ...periods.map((_, i) => `${pointX(i)},${pointY(gainTops[i])}`),
    ...periods.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${pointY(0)}`),
  ].join(' ');

  // A trend needs two steps to be a trend — by year that means two
  // different years, not just two logged entries.
  if (series.length < 2 || periods.length < 2) {
    return <Text style={styles.hint}>{t(byYear ? 'investmentGrowth.notEnoughYears' : 'investmentGrowth.notEnoughHistory')}</Text>;
  }

  return (
    <View style={styles.container}>
      {mode === 'stacked' ? (
        <View style={styles.summaryRow}>
          <SummaryStat label={t('investmentGrowth.depositedLabel')} value={formatMoney(latest!.depositedCents)} color={colors.textMuted} />
          <SummaryStat
            label={t('investmentGrowth.gainLabel')}
            value={`${latest!.gainCents >= 0 ? '+' : ''}${formatMoney(latest!.gainCents)}${gainPct != null ? ` (${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)` : ''}`}
            color={gainColor}
          />
          <SummaryStat label={t('investmentGrowth.totalLabel')} value={formatMoney(latest!.totalCents)} />
        </View>
      ) : (
        <SummaryStat label={t('investmentGrowth.totalLabel')} value={formatMoney(latest!.totalCents)} />
      )}
      {mode === 'stacked' && latest!.depositedCents === 0 ? <Text style={styles.hint}>{t('investmentGrowth.noDepositsHint')}</Text> : null}

      <View style={styles.chartRow}>
        <View style={[styles.yAxis, { height: CHART_HEIGHT, width: Y_AXIS_WIDTH }]}>
          {yTicks.map((v) => (
            <Text key={v} style={[styles.yAxisLabel, { top: pointY(v) - 7 }]}>
              {formatMoneyCompact(v)}
            </Text>
          ))}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View>
            <Svg width={chartWidth} height={CHART_HEIGHT}>
              {yTicks.map((v) => (
                <Line key={v} x1={0} y1={pointY(v)} x2={chartWidth} y2={pointY(v)} stroke={colors.border} strokeWidth={1} />
              ))}
              {mode === 'stacked' ? (
                <>
                  <Polygon points={depositedBand} fill={colors.textMuted} fillOpacity={0.35} />
                  <Polygon points={gainBand} fill={gainColor} fillOpacity={0.45} />
                </>
              ) : (
                <Polygon points={singleBand} fill={colors.accent} fillOpacity={0.35} />
              )}
              <Polyline points={totalLine} fill="none" stroke={colors.text} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <View style={[styles.xLabels, { width: chartWidth }]}>
              {periods.map((period, i) => {
                const isYearMarker = byYear || i === 0 || period.endsWith('-01');
                const locale = localeTag(language);
                return (
                  <Text key={period} style={[styles.xLabel, isYearMarker && styles.xLabelYear]}>
                    {byYear
                      ? period
                      : isYearMarker
                        ? `${formatMonthShort(period, locale)} ’${period.slice(2, 4)}`
                        : formatMonthShort(period, locale)}
                  </Text>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: 2 },
  statLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  chartRow: { flexDirection: 'row' },
  yAxis: { position: 'relative' },
  yAxisLabel: { position: 'absolute', right: 6, fontSize: 10, color: colors.textMuted },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  xLabel: { fontSize: 10, color: colors.textMuted },
  xLabelYear: { fontWeight: '700', color: colors.text },
});
