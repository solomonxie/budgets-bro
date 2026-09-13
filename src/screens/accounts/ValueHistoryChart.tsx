import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Polygon, Polyline } from 'react-native-svg';
import { buildGrowthSeries, projectGrowthOntoMonths } from '../../domain/investmentGrowth';
import { currentMonth, formatMonthShort, monthsBetween } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useI18n, localeTag } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const VISIBLE_MONTHS = 12;
const CHART_HEIGHT = 120;
const Y_AXIS_WIDTH = 44;
const MIN_MONTH_WIDTH = 28;

// Compact axis label — formatMoney's full "$1,234.56" is too wide for a
// narrow axis column (same helper as InsightsScreen's trend chart).
function formatAxisValue(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(dollars)}`;
}

export type ValueHistoryChartMode = 'stacked' | 'single';

// A manually-logged value history (account_value_history), resampled onto
// a real monthly calendar and drawn as a scrollable area chart — same
// shape/interaction as InsightsScreen's category-trend chart (12 months
// visible by default, drag to see further back, Jan/Feb.. labels with a
// year marker). Shared by every account kind that logs one of these:
// - 'stacked': deposited (net real transactions) as the base band, gain
//   stacked on top — savings/cash/tracking accounts (see
//   domain/investmentGrowth.ts).
// - 'single': one band, the logged value itself — a mortgage's home
//   value, which has no "deposits" concept to split out.
export function ValueHistoryChart({
  history,
  transactions = [],
  mode,
}: {
  history: { valueCents: number; effectiveDate: string }[];
  transactions?: { amountCents: number; date: string }[];
  mode: ValueHistoryChartMode;
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

  const months = useMemo(
    () => (series.length > 0 ? monthsBetween(series[0].date.slice(0, 7), currentMonth()) : []),
    [series],
  );
  const projected = useMemo(() => projectGrowthOntoMonths(series, months), [series, months]);

  const fittedWidth = Math.max(200, windowWidth - spacing.md * 4 - Y_AXIS_WIDTH);
  const monthWidth = Math.max(MIN_MONTH_WIDTH, fittedWidth / VISIBLE_MONTHS);
  const chartWidth = Math.max(fittedWidth, months.length * monthWidth);
  const pointX = (i: number) => (months.length > 1 ? (i / (months.length - 1)) * chartWidth : chartWidth / 2);

  const maxValue = Math.max(1, ...projected.map((p) => (p ? Math.max(p.totalCents, p.depositedCents) : 0)));
  const pointY = (v: number) => CHART_HEIGHT - (v / maxValue) * (CHART_HEIGHT - 8) - 4;
  const yTicks = [maxValue, maxValue / 2, 0];

  const depositedTops = projected.map((p) => (p ? Math.max(0, p.depositedCents) : 0));
  const gainTops = projected.map((p, i) => (p ? depositedTops[i] + Math.max(0, p.gainCents) : depositedTops[i]));
  const totalLine = projected.map((p, i) => `${pointX(i)},${pointY(p ? p.totalCents : 0)}`).join(' ');
  const depositedBand = [
    ...months.map((_, i) => `${pointX(i)},${pointY(depositedTops[i])}`),
    ...months.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${pointY(0)}`),
  ].join(' ');
  const gainBand = [
    ...months.map((_, i) => `${pointX(i)},${pointY(gainTops[i])}`),
    ...months.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${pointY(depositedTops[arr.length - 1 - i])}`),
  ].join(' ');
  const singleBand = [
    ...months.map((_, i) => `${pointX(i)},${pointY(gainTops[i])}`),
    ...months.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${pointY(0)}`),
  ].join(' ');

  if (series.length < 2) {
    return <Text style={styles.hint}>{t('investmentGrowth.notEnoughHistory')}</Text>;
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
              {formatAxisValue(v)}
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
              {months.map((m, i) => {
                const isYearMarker = i === 0 || m.endsWith('-01');
                const locale = localeTag(language);
                return (
                  <Text key={m} style={[styles.xLabel, isYearMarker && styles.xLabelYear]}>
                    {isYearMarker ? `${formatMonthShort(m, locale)} ’${m.slice(2, 4)}` : formatMonthShort(m, locale)}
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
