import { useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Polyline, Rect } from 'react-native-svg';
import { useChartScrub } from './chartScrub';
import { formatMonthShort } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { trailingAverages } from '../../domain/movingAverage';
import { localeTag, useI18n } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const CHART_HEIGHT = 88;
const MIN_BAR_SLOT = 34;
const BAR_GAP = 2;

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
  // Each month against its own recent past, not a whole-history average —
  // the series starts at the first payment, so no padding months drag it.
  const averages = useMemo(
    () =>
      trailingAverages(
        series.map((m) => ({ date: m.month, value: m.spentCents })),
      ),
    [series],
  );

  if (series.length === 0) return null;

  const maxCents = Math.max(...series.map((m) => m.spentCents));
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
  const shownIndex = activeIndex ?? series.length - 1;
  const shown = series[shownIndex];
  const averageCents = Math.round(averages[shownIndex] ?? 0);
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
            {maxCents > 0 ? (
              <Polyline
                points={averages
                  .map(
                    (a, i) =>
                      `${i * slot + slot / 2},${CHART_HEIGHT - barHeight(a ?? 0)}`,
                  )
                  .join(' ')}
                fill="none"
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
