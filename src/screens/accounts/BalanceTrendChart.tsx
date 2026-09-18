import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Polygon, Polyline } from 'react-native-svg';
import type { BalanceTrendPoint } from '../../domain/balanceTrend';
import { formatMonthShort } from '../../domain/month';
import { formatMoney, formatMoneyCompact } from '../../domain/money';
import { useI18n, localeTag, useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const VISIBLE_MONTHS = 12;
const CHART_HEIGHT = 120;
const Y_AXIS_WIDTH = 44;
const MIN_MONTH_WIDTH = 28;

// A ledger-derived balance-over-time line (see domain/balanceTrend.ts) — no
// manual logging involved, unlike ValueHistoryChart's tracking/asset
// snapshots. `showSpending` overlays each month's total outflow as a second
// line on the same axis — a credit card's balance alone reads as flat/tiny
// for anyone who pays it off every cycle, so the spend itself needs its own
// line to show real usage.
export function BalanceTrendChart({
  points,
  showSpending = false,
  valueLabel,
}: {
  points: BalanceTrendPoint[];
  showSpending?: boolean;
  // What the line is of — "Balance" on an account, "Net Worth" on the
  // accounts list. Same shape either way: one level over months.
  valueLabel?: string;
}) {
  const t = useT();
  const { language } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const fittedWidth = Math.max(200, windowWidth - spacing.md * 4 - Y_AXIS_WIDTH);
  const monthWidth = Math.max(MIN_MONTH_WIDTH, fittedWidth / VISIBLE_MONTHS);
  const chartWidth = Math.max(fittedWidth, points.length * monthWidth);
  const pointX = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * chartWidth : chartWidth / 2);

  const maxValue = useMemo(
    () =>
      Math.max(
        1,
        ...points.map((p) => Math.abs(p.balanceCents)),
        ...(showSpending ? points.map((p) => p.spendingCents) : []),
      ),
    [points, showSpending],
  );
  const pointY = (v: number) => CHART_HEIGHT - (v / maxValue) * (CHART_HEIGHT - 8) - 4;
  const zeroY = pointY(0);
  const yTicks = [maxValue, maxValue / 2, 0];

  const balanceLine = points.map((p, i) => `${pointX(i)},${pointY(p.balanceCents)}`).join(' ');
  const balanceBand = [
    ...points.map((p, i) => `${pointX(i)},${pointY(p.balanceCents)}`),
    ...points.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${zeroY}`),
  ].join(' ');
  const spendingLine = points.map((p, i) => `${pointX(i)},${pointY(p.spendingCents)}`).join(' ');

  const latest = points.at(-1) ?? null;

  if (points.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <SummaryStat
          label={valueLabel ?? t('balanceTrendChart.balanceLabel')}
          value={latest ? formatMoney(latest.balanceCents) : '—'}
        />
        {showSpending ? (
          <SummaryStat
            label={t('balanceTrendChart.spendingLabel')}
            value={latest ? formatMoney(-latest.spendingCents) : '—'}
            color={colors.negative}
          />
        ) : null}
      </View>
      {showSpending ? (
        <View style={styles.legendRow}>
          <LegendItem color={colors.accent} label={t('balanceTrendChart.balanceLabel')} />
          <LegendItem color={colors.negative} label={t('balanceTrendChart.spendingLabel')} />
        </View>
      ) : null}
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
              <Polygon points={balanceBand} fill={colors.accent} fillOpacity={0.2} />
              <Polyline points={balanceLine} fill="none" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              {showSpending ? (
                <Polyline points={spendingLine} fill="none" stroke={colors.negative} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </Svg>
            <View style={[styles.xLabels, { width: chartWidth }]}>
              {points.map((p, i) => {
                const isYearMarker = i === 0 || p.month.endsWith('-01');
                const locale = localeTag(language);
                return (
                  <Text key={p.month} style={[styles.xLabel, isYearMarker && styles.xLabelYear]}>
                    {isYearMarker ? `${formatMonthShort(p.month, locale)} ’${p.month.slice(2, 4)}` : formatMonthShort(p.month, locale)}
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

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  summaryRow: { flexDirection: 'row', gap: spacing.lg },
  stat: { gap: 2 },
  statLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  legendRow: { flexDirection: 'row', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: colors.textMuted },
  chartRow: { flexDirection: 'row' },
  yAxis: { position: 'relative' },
  yAxisLabel: { position: 'absolute', right: 6, fontSize: 10, color: colors.textMuted },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  xLabel: { fontSize: 10, color: colors.textMuted },
  xLabelYear: { fontWeight: '700', color: colors.text },
});
