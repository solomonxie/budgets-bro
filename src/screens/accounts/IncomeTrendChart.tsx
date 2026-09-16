import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { formatMoneyCompact } from '../../domain/money';
import { formatMonthShort } from '../../domain/month';
import { useI18n, localeTag } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const VISIBLE_MONTHS = 12;
const CHART_HEIGHT = 120;
const Y_AXIS_WIDTH = 44;
const MIN_MONTH_WIDTH = 28;

export interface IncomeTrendPoint {
  month: string; // 'YYYY-MM'
  totalCents: number;
}

// A month's income is a flow (this period's total), not a level like a
// logged account value — bars, not the area/line ValueHistoryChart draws
// for a value-history log. Same scrollable "12 months visible, drag for
// more, Jan/Feb.. + year markers" shell for a consistent feel across the
// app's charts.
export function IncomeTrendChart({ points }: { points: IncomeTrendPoint[] }) {
  const { language } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const fittedWidth = Math.max(200, windowWidth - spacing.md * 4 - Y_AXIS_WIDTH);
  const monthWidth = Math.max(MIN_MONTH_WIDTH, fittedWidth / VISIBLE_MONTHS);
  const chartWidth = Math.max(fittedWidth, points.length * monthWidth);
  const barWidth = Math.min(monthWidth * 0.6, 22);

  const maxValue = useMemo(() => Math.max(1, ...points.map((p) => p.totalCents)), [points]);
  const pointY = (v: number) => CHART_HEIGHT - (v / maxValue) * (CHART_HEIGHT - 8) - 4;
  const yTicks = [maxValue, maxValue / 2, 0];

  if (points.length === 0) return null;

  return (
    <View style={styles.container}>
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
              {points.map((p, i) => {
                const slotCenter = points.length > 1 ? (i / (points.length - 1)) * (chartWidth - monthWidth) + monthWidth / 2 : chartWidth / 2;
                const top = pointY(p.totalCents);
                return (
                  <Rect
                    key={p.month}
                    x={slotCenter - barWidth / 2}
                    y={top}
                    width={barWidth}
                    height={Math.max(0, CHART_HEIGHT - 4 - top)}
                    rx={3}
                    fill={colors.accent}
                    fillOpacity={0.75}
                  />
                );
              })}
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

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  chartRow: { flexDirection: 'row' },
  yAxis: { position: 'relative' },
  yAxisLabel: { position: 'absolute', right: 6, fontSize: 10, color: colors.textMuted },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  xLabel: { fontSize: 10, color: colors.textMuted },
  xLabelYear: { fontWeight: '700', color: colors.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  summaryText: { fontSize: 11, color: colors.textMuted },
});
