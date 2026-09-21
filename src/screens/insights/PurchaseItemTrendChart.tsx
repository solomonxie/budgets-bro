import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { ScrubMarker, useChartScrub } from '../../components/ui/chartScrub';
import type { PurchaseItemTrend } from '../../domain/purchaseInsights';
import { formatMoneyExact } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const CHART_HEIGHT = 96;
const MIN_POINT_WIDTH = 46;

// What one thing cost, each time it was bought, against what it usually
// costs. Exact cents here, not the app's usual whole dollars: the whole
// question is whether a $8.40 bottle is now $9.20.
export function PurchaseItemTrendChart({ trend }: { trend: PurchaseItemTrend }) {
  const t = useT();
  const { width: windowWidth } = useWindowDimensions();
  const [index, setIndex] = useState<number | null>(null);

  const { points, benchmarkCents } = trend;
  const fittedWidth = Math.max(160, windowWidth - spacing.md * 6);
  const chartWidth = Math.max(fittedWidth, points.length * MIN_POINT_WIDTH);
  const { scrollEnabled, handlers } = useChartScrub({
    count: points.length,
    chartWidth,
    onSelect: setIndex,
  });

  if (points.length === 0) return null;

  const prices = points.map((p) => p.priceCents);
  const values = benchmarkCents != null ? [...prices, benchmarkCents] : prices;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  // A flat line (one price, bought again at the same price) would divide by
  // zero — it sits in the middle instead.
  const span = Math.max(1, maxValue - minValue);
  const pointY = (cents: number) =>
    maxValue === minValue
      ? CHART_HEIGHT / 2
      : CHART_HEIGHT - ((cents - minValue) / span) * (CHART_HEIGHT - 16) - 8;
  const pointX = (i: number) =>
    points.length > 1 ? (i / (points.length - 1)) * chartWidth : chartWidth / 2;

  const line = points.map((p, i) => `${pointX(i)},${pointY(p.priceCents)}`).join(' ');
  const selected = index != null ? (points[index] ?? null) : null;
  const latest = points[points.length - 1];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headline}>
          {formatMoneyExact((selected ?? latest).priceCents)}
        </Text>
        <Text style={styles.headlineLabel}>
          {selected ? selected.date : t('purchaseInsights.latestPrice')}
        </Text>
        {benchmarkCents != null ? (
          <Text style={styles.benchmark}>
            {t('purchaseInsights.average')} {formatMoneyExact(benchmarkCents)}
          </Text>
        ) : null}
      </View>
      <ScrollView horizontal scrollEnabled={scrollEnabled} showsHorizontalScrollIndicator={false}>
        <View {...handlers}>
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            {benchmarkCents != null ? (
              <Line
                x1={0}
                y1={pointY(benchmarkCents)}
                x2={chartWidth}
                y2={pointY(benchmarkCents)}
                stroke={colors.textMuted}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ) : null}
            <Polyline
              points={line}
              fill="none"
              stroke={colors.accent}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <Circle
                key={p.date}
                cx={pointX(i)}
                cy={pointY(p.priceCents)}
                r={2.5}
                fill={colors.accent}
              />
            ))}
            {selected && index != null ? (
              <ScrubMarker
                x={pointX(index)}
                y={pointY(selected.priceCents)}
                height={CHART_HEIGHT}
              />
            ) : null}
          </Svg>
          <View style={[styles.xLabels, { width: chartWidth }]}>
            {points.map((p) => (
              <Text key={p.date} style={styles.xLabel} numberOfLines={1}>
                {p.date.slice(5)}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  headline: { fontSize: 20, fontWeight: '700', color: colors.text },
  headlineLabel: { fontSize: 12, color: colors.textMuted, flex: 1 },
  benchmark: { fontSize: 12, color: colors.textMuted },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  xLabel: { fontSize: 9, color: colors.textMuted, flex: 1, textAlign: 'center' },
});
