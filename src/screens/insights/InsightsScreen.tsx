import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Line, Polygon, Polyline } from 'react-native-svg';
import { ScrubMarker, useChartScrub } from '../../components/ui/chartScrub';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { MonthNav } from '../../components/ui/MonthNav';
import { useInsights } from '../../hooks/useInsights';
import {
  currentMonth,
  nextMonth,
  previousMonth,
  formatMonthLabel,
  formatMonthShort,
} from '../../domain/month';
import { formatMoney, formatMoneyCompact } from '../../domain/money';
import { useI18n, localeTag } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useFlaggedCount } from '../../hooks/useFlaggedCount';
import type {
  InsightsStackParamList,
  RootStackParamList,
} from '../../navigation/types';

type Nav = NativeStackNavigationProp<InsightsStackParamList, 'InsightsHome'>;
// Flat, domain-shaped: each row is a hub that opens with your real
// accounts for that domain and its own calculators underneath.
type UtilityScreen =
  | 'BabySteps'
  | 'MortgageInsights'
  | 'LoanInsights'
  | 'InvestmentInsights'
  | 'TaxInsights'
  | 'TrackedPrices'
  | 'PayeeTrend'
  | 'ExchangeInsights'
  | 'CostOfLiving'
  | 'Housing'
  | 'AiAnalysis';
// The flagged worklist sits in this list too, but lives on the root stack
// rather than this tab's — reached the same way from the history page.
type UtilityRow =
  | { label: string; screen: UtilityScreen; root?: false }
  | { label: string; screen: 'FlaggedTransactions'; root: true };

// Validated categorical palette (dataviz skill), dark-surface steps — fixed
// order, never cycled.
const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const OTHER_COLOR = colors.textMuted;
const TOP_N = 5;
const MONTH_WIDTH = 44;
const Y_AXIS_WIDTH = 44;

export function InsightsScreen() {
  const { t, language } = useI18n();
  const UTILITY_ROWS: UtilityRow[] = [
    { label: t('insights.payeeTrend'), screen: 'PayeeTrend' },
    { label: t('insights.trackedPrices'), screen: 'TrackedPrices' },
    { label: t('review.title'), screen: 'FlaggedTransactions', root: true },
    { label: t('insights.babySteps'), screen: 'BabySteps' },
    { label: t('insights.mortgageInsights'), screen: 'MortgageInsights' },
    { label: t('insights.loanInsights'), screen: 'LoanInsights' },
    { label: t('insights.investmentInsights'), screen: 'InvestmentInsights' },
    { label: t('insights.taxInsights'), screen: 'TaxInsights' },
    { label: t('insights.exchangeInsights'), screen: 'ExchangeInsights' },
    { label: t('insights.costOfLiving'), screen: 'CostOfLiving' },
    { label: t('insights.housing'), screen: 'Housing' },
    { label: t('aiAnalysis.title'), screen: 'AiAnalysis' },
  ];
  const navigation = useNavigation<Nav>();
  // The review page is a root-stack route, not one of this tab's — it is
  // reached the same way from the history page.
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const flaggedCount = useFlaggedCount();
  const [month, setMonth] = useState(currentMonth());
  const { spending, trendPoints, trendMonths } = useInsights(month);
  const { width: windowWidth } = useWindowDimensions();
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<Set<number>>(
    new Set(),
  );
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const trendScrollRef = useRef<ScrollView>(null);

  const toggleCategoryVisible = (categoryId: number) => {
    setHiddenCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const totalSpentCents = spending.reduce((s, c) => s + c.spentCents, 0);
  const top = spending.slice(0, TOP_N);
  const other = spending.slice(TOP_N);
  const otherCents = other.reduce((s, c) => s + c.spentCents, 0);
  const segments =
    otherCents > 0
      ? [
          ...top,
          {
            categoryId: -1,
            name: t('transactions.allOthers'),
            icon: null,
            spentCents: otherCents,
          },
        ]
      : top;

  // "All Others" (categoryId -1) is a synthetic bucket, not a real
  // category — Transactions matches it against the actual set of
  // categories it's made of (`categoryIds`) instead of a single `categoryId`.
  const openCategoryTransactions = (categoryId: number) => {
    if (categoryId === -1) {
      navigation.navigate('Transactions', {
        categoryIds: other.map((c) => c.categoryId),
        month,
      });
    } else {
      navigation.navigate('Transactions', { categoryId, month });
    }
  };

  const trend = useMemo(() => {
    const totalsByCategory = new Map<
      number,
      { name: string; icon: string | null; total: number }
    >();
    for (const p of trendPoints) {
      const entry = totalsByCategory.get(p.categoryId) ?? {
        name: p.name,
        icon: p.icon,
        total: 0,
      };
      entry.total += p.spentCents;
      totalsByCategory.set(p.categoryId, entry);
    }
    const topCategoryIds = [...totalsByCategory.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, TOP_N)
      .map(([id]) => id);

    const series = topCategoryIds.map((categoryId, i) => {
      const meta = totalsByCategory.get(categoryId)!;
      const values = trendMonths.map(
        (m) =>
          trendPoints.find((p) => p.categoryId === categoryId && p.month === m)
            ?.spentCents ?? 0,
      );
      return {
        categoryId,
        name: meta.name,
        icon: meta.icon,
        color: SERIES_COLORS[i],
        values,
      };
    });
    return { series };
  }, [trendPoints, trendMonths]);

  const visibleSeries = trend.series.filter(
    (s) => !hiddenCategoryIds.has(s.categoryId),
  );
  // Stacked, so the axis scales to each month's *total* (all visible
  // series summed), not any single series' peak.
  const monthTotals = trendMonths.map((_, i) =>
    visibleSeries.reduce((sum, s) => sum + s.values[i], 0),
  );
  const maxValue = Math.max(1, ...monthTotals);

  // Each series' band sits between the running total *before* it and
  // *after* it — stacked area, so a month's total spend is one glance
  // (the top edge) instead of mentally summing crossing lines.
  const stackedBands = visibleSeries.reduce<
    { categoryId: number; color: string; bottoms: number[]; tops: number[] }[]
  >((bands, s) => {
    const bottoms =
      bands.length > 0
        ? bands[bands.length - 1].tops
        : trendMonths.map(() => 0);
    const tops = trendMonths.map((_, i) => bottoms[i] + s.values[i]);
    return [
      ...bands,
      { categoryId: s.categoryId, color: s.color, bottoms, tops },
    ];
  }, []);

  // Same "trailing 12 months, excluding the month being looked at" rule as
  // Budget's top-card compare — averaged over this chart's own monthTotals
  // (the visible top-N stack), not a separate full-ledger total, so the
  // benchmark line is on the same scale as what's actually plotted.
  const priorMonthCount = Math.max(0, monthTotals.length - 1);
  const benchmarkWindow = monthTotals.slice(
    Math.max(0, priorMonthCount - 12),
    priorMonthCount,
  );
  const benchmarkCents =
    benchmarkWindow.length > 0
      ? Math.round(
          benchmarkWindow.reduce((sum, v) => sum + v, 0) /
            benchmarkWindow.length,
        )
      : null;

  const fittedWidth = Math.max(
    200,
    windowWidth - spacing.md * 2 - spacing.md * 2 - Y_AXIS_WIDTH,
  );
  const chartWidth = Math.max(fittedWidth, trendMonths.length * MONTH_WIDTH);
  const chartHeight = 130;
  const pointX = (i: number) =>
    trendMonths.length > 1
      ? (i / (trendMonths.length - 1)) * chartWidth
      : chartWidth / 2;
  const pointY = (v: number) =>
    chartHeight - (v / maxValue) * (chartHeight - 8) - 4;
  const yTicks = [maxValue, maxValue / 2, 0];

  // Reading the trend with a finger — the same gesture and marker the net
  // worth line uses (components/ui/chartScrub). The month under it is
  // named above the chart, with what was spent in it.
  const { scrollEnabled: trendScrollEnabled, handlers: trendHandlers } =
    useChartScrub({
      count: trendMonths.length,
      chartWidth,
      onSelect: setScrubIndex,
    });
  const scrubbedMonth =
    scrubIndex != null ? (trendMonths[scrubIndex] ?? null) : null;

  return (
    <ScreenContainer scroll>
      <MonthNav
        label={formatMonthLabel(month, localeTag(language))}
        onPrevious={() => setMonth(previousMonth(month))}
        onNext={() => setMonth(nextMonth(month))}
        month={month}
        onSelect={setMonth}
      />
      <View style={styles.card}>
        <Text style={styles.label}>{t('insights.spendingBreakdown')}</Text>
        <Text style={styles.value}>{formatMoney(totalSpentCents)}</Text>
        <View style={styles.stackBar}>
          {segments.map((seg, i) => (
            <View
              key={seg.categoryId}
              style={{
                width: `${totalSpentCents > 0 ? (seg.spentCents / totalSpentCents) * 100 : 0}%`,
                backgroundColor: i < TOP_N ? SERIES_COLORS[i] : OTHER_COLOR,
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('insights.topCategories')}</Text>
        {segments.map((seg, i) => (
          <Pressable
            key={seg.categoryId}
            style={styles.legendRow}
            onPress={() => openCategoryTransactions(seg.categoryId)}
          >
            <View style={styles.legendLeft}>
              <View
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: i < TOP_N ? SERIES_COLORS[i] : OTHER_COLOR,
                  },
                ]}
              />
              <Text style={styles.legendName}>
                {seg.icon ? `${seg.icon} ` : ''}
                {seg.name}
              </Text>
            </View>
            <Text style={styles.legendValue}>
              {formatMoney(seg.spentCents)}
            </Text>
          </Pressable>
        ))}
        {segments.length === 0 ? (
          <Text style={styles.empty}>{t('insights.noSpending')}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('insights.categoryTrends')}</Text>
        {scrubbedMonth != null && scrubIndex != null ? (
          <Text style={styles.value}>
            {formatMonthLabel(scrubbedMonth, localeTag(language))} ·{' '}
            {formatMoney(monthTotals[scrubIndex] ?? 0)}
          </Text>
        ) : (
          <Text style={styles.sectionHint}>{t('insights.trendHint')}</Text>
        )}
        {trend.series.length === 0 ? (
          <Text style={styles.empty}>{t('insights.notEnoughHistory')}</Text>
        ) : (
          <>
            <View style={styles.trendChartRow}>
              <View
                style={[
                  styles.yAxis,
                  { height: chartHeight, width: Y_AXIS_WIDTH },
                ]}
              >
                {yTicks.map((v) => (
                  <Text
                    key={v}
                    style={[styles.yAxisLabel, { top: pointY(v) - 7 }]}
                  >
                    {formatMoneyCompact(v)}
                  </Text>
                ))}
                {benchmarkCents != null ? (
                  <Text
                    style={[
                      styles.yAxisLabel,
                      styles.yAxisBenchmarkLabel,
                      { top: pointY(benchmarkCents) - 7 },
                    ]}
                  >
                    {t('insights.avgAxisLabel')}
                  </Text>
                ) : null}
              </View>
              <ScrollView
                ref={trendScrollRef}
                horizontal
                scrollEnabled={trendScrollEnabled}
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={() =>
                  trendScrollRef.current?.scrollToEnd({ animated: false })
                }
              >
                <View {...trendHandlers}>
                  <Svg width={chartWidth} height={chartHeight}>
                    {yTicks.map((v) => (
                      <Line
                        key={v}
                        x1={0}
                        y1={pointY(v)}
                        x2={chartWidth}
                        y2={pointY(v)}
                        stroke={colors.border}
                        strokeWidth={1}
                      />
                    ))}
                    {stackedBands.map((band) => (
                      <Polygon
                        key={band.categoryId}
                        points={[
                          ...trendMonths.map(
                            (_, i) => `${pointX(i)},${pointY(band.tops[i])}`,
                          ),
                          ...trendMonths.map(
                            (_, i, arr) =>
                              `${pointX(arr.length - 1 - i)},${pointY(band.bottoms[arr.length - 1 - i])}`,
                          ),
                        ].join(' ')}
                        fill={band.color}
                        fillOpacity={0.55}
                      />
                    ))}
                    {stackedBands.map((band) => (
                      <Polyline
                        key={`${band.categoryId}-edge`}
                        points={trendMonths
                          .map((_, i) => `${pointX(i)},${pointY(band.tops[i])}`)
                          .join(' ')}
                        fill="none"
                        stroke={band.color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                    {benchmarkCents != null ? (
                      <Line
                        x1={0}
                        y1={pointY(benchmarkCents)}
                        x2={chartWidth}
                        y2={pointY(benchmarkCents)}
                        stroke={colors.accent}
                        strokeWidth={1.5}
                        strokeDasharray="6,4"
                      />
                    ) : null}
                    {scrubIndex != null ? (
                      <ScrubMarker
                        x={pointX(scrubIndex)}
                        y={pointY(monthTotals[scrubIndex] ?? 0)}
                        height={chartHeight}
                      />
                    ) : null}
                  </Svg>
                  <View style={[styles.trendXLabels, { width: chartWidth }]}>
                    {trendMonths.map((m, i) => {
                      // January (or the leftmost tick, if the range starts
                      // mid-year) gets the year appended — otherwise a
                      // multi-year "all time" range reads as one ambiguous
                      // loop of Jan..Dec.
                      const isYearMarker = i === 0 || m.endsWith('-01');
                      const locale = localeTag(language);
                      return (
                        <Text
                          key={m}
                          style={[
                            styles.trendLabel,
                            isYearMarker && styles.trendLabelYear,
                          ]}
                        >
                          {isYearMarker
                            ? `${formatMonthShort(m, locale)} ’${m.slice(2, 4)}`
                            : formatMonthShort(m, locale)}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </View>
            <View style={styles.legendKey}>
              {trend.series.map((s) => {
                const hidden = hiddenCategoryIds.has(s.categoryId);
                return (
                  <Pressable
                    key={s.categoryId}
                    style={[
                      styles.legendKeyItem,
                      hidden && styles.legendKeyItemHidden,
                    ]}
                    onPress={() => toggleCategoryVisible(s.categoryId)}
                  >
                    <View
                      style={[
                        styles.legendKeySwatch,
                        { backgroundColor: hidden ? colors.border : s.color },
                      ]}
                    />
                    <Text style={styles.legendKeyText}>
                      {s.icon ? `${s.icon} ` : ''}
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.utilities}>
        <Text style={styles.sectionTitle}>{t('insights.utilities')}</Text>
        <Text style={styles.sectionHint}>{t('insights.utilitiesHint')}</Text>
      </View>
      <View style={styles.card}>
        {UTILITY_ROWS.map((row, i) => (
          <Pressable
            key={row.screen}
            style={[
              styles.toolRow,
              i < UTILITY_ROWS.length - 1 && styles.toolRowDivider,
            ]}
            onPress={() =>
              row.root
                ? rootNavigation.navigate(row.screen)
                : navigation.navigate(row.screen)
            }
          >
            <Text style={styles.toolRowText}>{row.label}</Text>
            <View style={styles.toolRowRight}>
              {/* A count is only worth as much as the rows behind it, so it
                  rides on the row itself rather than a separate header. */}
              {row.root && flaggedCount > 0 ? (
                <Text style={styles.toolRowBadge}>{flaggedCount}</Text>
              ) : null}
              <Text style={styles.toolRowArrow}>›</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  sectionHint: { fontSize: 11, color: colors.textMuted },
  // Not another 12px uppercase label: this is a page section, not a card
  // caption, and at the same weight as the card labels above it the list
  // underneath read as part of the trends card.
  utilities: { marginTop: spacing.lg, gap: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  value: { fontSize: 30, fontWeight: '700', color: colors.text },
  negative: { color: colors.negative },
  stackBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorDot: { width: 9, height: 9, borderRadius: 999 },
  legendName: { fontSize: 14, color: colors.text },
  legendValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  empty: { color: colors.textMuted, fontSize: 13 },
  trendChartRow: { flexDirection: 'row' },
  yAxis: { position: 'relative' },
  yAxisLabel: {
    position: 'absolute',
    right: 6,
    fontSize: 10,
    color: colors.textMuted,
  },
  yAxisBenchmarkLabel: { color: colors.accent, fontWeight: '700' },
  trendXLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  trendLabel: { fontSize: 10, color: colors.textMuted },
  trendLabelYear: { fontWeight: '700', color: colors.text },
  legendKey: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  legendKeyItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendKeyItemHidden: { opacity: 0.4 },
  legendKeySwatch: { width: 8, height: 8, borderRadius: 2 },
  legendKeyText: { fontSize: 11, color: colors.textMuted },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toolRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  toolRowText: { fontSize: 15, fontWeight: '600', color: colors.text },
  toolRowArrow: { fontSize: 18, color: colors.textMuted },
  toolRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toolRowBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 1,
    paddingHorizontal: 8,
  },
});
