import { useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { useChartScrub } from './chartScrub';
import { formatMonthShort } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { localeTag, useI18n } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const CHART_HEIGHT = 88;
const MIN_BAR_SLOT = 34;
const BAR_GAP = 2;
// The benchmark line is a recent typical month, not a whole-history one — a
// payee with three years behind it shouldn't have that history dragging an
// average that's meant to say "what does this cost me lately".
const AVERAGE_WINDOW_MONTHS = 12;

export interface MonthAmount {
  month: string;
  spentCents: number;
}

// Spending month by month — one payee's, or whatever a list is filtered to.
// Bars rather than a line: these are separate monthly totals with a real
// zero, and a month with nothing spent is a fact, not a gap in the data.
//
// Longer than fits scrolls sideways and opens at the newest month, the same
// as the category trend. `selectedMonth` is what the headline reads when no
// finger is on the chart — the month a list is filtered to.
export function MonthlyBarChart({
  series,
  selectedMonth = null,
}: {
  series: MonthAmount[];
  selectedMonth?: string | null;
}) {
  const { t, language } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const [index, setIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const fittedWidth = Math.max(160, windowWidth - spacing.md * 5);
  const chartWidth = Math.max(fittedWidth, series.length * MIN_BAR_SLOT);
  const { scrollEnabled, handlers } = useChartScrub({
    count: series.length,
    chartWidth,
    onSelect: setIndex,
  });

  if (series.length === 0) return null;

  const maxCents = Math.max(...series.map((m) => m.spentCents));
  // Series already starts at this payee's first payment, so the last 12
  // months of it is never padded with months from before that.
  const recentMonths = series.slice(-AVERAGE_WINDOW_MONTHS);
  const averageCents = Math.round(
    recentMonths.reduce((sum, m) => sum + m.spentCents, 0) /
      recentMonths.length,
  );
  const slot = chartWidth / series.length;
  const barWidth = Math.max(4, slot - BAR_GAP * 2);
  // Every bar shares one scale off the window's biggest month, so a short
  // bar is a cheap month rather than a differently-drawn one.
  const barHeight = (cents: number) =>
    maxCents > 0 ? (cents / maxCents) * (CHART_HEIGHT - 8) : 0;

  const pinnedIndex =
    selectedMonth != null
      ? series.findIndex((m) => m.month === selectedMonth)
      : -1;
  const activeIndex = index ?? (pinnedIndex >= 0 ? pinnedIndex : null);
  const shown = series[activeIndex ?? series.length - 1];
  const locale = localeTag(language);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headline}>{formatMoney(shown.spentCents)}</Text>
        <Text style={styles.headlineLabel}>
          {formatMonthShort(shown.month, locale)} ’{shown.month.slice(2, 4)}
        </Text>
        <Text style={styles.benchmark}>
          {t('payeeTrend.avgPerMonth', {
            amount: formatMoney(averageCents),
          })}
        </Text>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        scrollEnabled={scrollEnabled}
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        <View {...handlers}>
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            {averageCents > 0 && maxCents > 0 ? (
              <Line
                x1={0}
                y1={CHART_HEIGHT - barHeight(averageCents)}
                x2={chartWidth}
                y2={CHART_HEIGHT - barHeight(averageCents)}
                stroke={colors.textMuted}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ) : null}
            {series.map((month, i) => {
              const height = barHeight(month.spentCents);
              return (
                <Rect
                  key={month.month}
                  x={i * slot + BAR_GAP}
                  y={CHART_HEIGHT - height}
                  width={barWidth}
                  height={Math.max(height, month.spentCents > 0 ? 2 : 0)}
                  rx={3}
                  fill={i === activeIndex ? colors.text : colors.accent}
                />
              );
            })}
          </Svg>
          <View style={[styles.xLabels, { width: chartWidth }]}>
            {series.map((month, i) => {
              // January (or the first bar, if the range starts mid-year)
              // carries the year — otherwise a multi-year history reads as
              // one ambiguous loop of Jan..Dec.
              const yearMarker = i === 0 || month.month.endsWith('-01');
              return (
                <Text
                  key={month.month}
                  style={[styles.xLabel, yearMarker && styles.xLabelYear]}
                  numberOfLines={1}
                >
                  {yearMarker
                    ? `${formatMonthShort(month.month, locale)} ’${month.month.slice(2, 4)}`
                    : formatMonthShort(month.month, locale)}
                </Text>
              );
            })}
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
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  xLabel: {
    fontSize: 9,
    color: colors.textMuted,
    flex: 1,
    textAlign: 'center',
  },
  xLabelYear: { color: colors.text },
});
