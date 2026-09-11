import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Polygon, Polyline } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { MonthNav } from '../../components/ui/MonthNav';
import { MonthPickerModal } from '../../components/ui/MonthPickerModal';
import { useInsights } from '../../hooks/useInsights';
import { currentMonth, nextMonth, previousMonth, formatMonthLabel, formatMonthShort } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { InsightsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<InsightsStackParamList, 'InsightsHome'>;
type ToolScreen = 'BabySteps' | 'TaxInsights' | 'Calculators' | 'AiAnalysis';

const TOOL_ROWS: { label: string; screen: ToolScreen }[] = [
  { label: 'Baby Steps', screen: 'BabySteps' },
  { label: 'Tax Insights', screen: 'TaxInsights' },
  { label: 'Calculators', screen: 'Calculators' },
  { label: 'AI Analysis', screen: 'AiAnalysis' },
];

// Validated categorical palette (dataviz skill), dark-surface steps — fixed
// order, never cycled.
const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const OTHER_COLOR = colors.textMuted;
const TOP_N = 5;
const MONTH_WIDTH = 44;
const Y_AXIS_WIDTH = 44;

// Compact axis label — formatMoney's full "$1,234.56" is too wide for a
// narrow trend-chart axis.
function formatAxisValue(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(dollars)}`;
}

export function InsightsScreen() {
  const navigation = useNavigation<Nav>();
  const [month, setMonth] = useState(currentMonth());
  const { spending, trendPoints, trendMonths } = useInsights(month);
  const { width: windowWidth } = useWindowDimensions();
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<Set<number>>(new Set());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
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
  const segments = otherCents > 0 ? [...top, { categoryId: -1, name: 'All Others', icon: null, spentCents: otherCents }] : top;

  // "All Others" (categoryId -1) is a synthetic bucket, not a real
  // category — Transactions matches it against the actual set of
  // categories it's made of (`categoryIds`) instead of a single `categoryId`.
  const openCategoryTransactions = (categoryId: number) => {
    if (categoryId === -1) {
      navigation.navigate('Transactions', { categoryIds: other.map((c) => c.categoryId), month });
    } else {
      navigation.navigate('Transactions', { categoryId, month });
    }
  };

  const trend = useMemo(() => {
    const totalsByCategory = new Map<number, { name: string; icon: string | null; total: number }>();
    for (const p of trendPoints) {
      const entry = totalsByCategory.get(p.categoryId) ?? { name: p.name, icon: p.icon, total: 0 };
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
        (m) => trendPoints.find((p) => p.categoryId === categoryId && p.month === m)?.spentCents ?? 0,
      );
      return { categoryId, name: meta.name, icon: meta.icon, color: SERIES_COLORS[i], values };
    });
    return { series };
  }, [trendPoints, trendMonths]);

  const visibleSeries = trend.series.filter((s) => !hiddenCategoryIds.has(s.categoryId));
  // Stacked, so the axis scales to each month's *total* (all visible
  // series summed), not any single series' peak.
  const monthTotals = trendMonths.map((_, i) => visibleSeries.reduce((sum, s) => sum + s.values[i], 0));
  const maxValue = Math.max(1, ...monthTotals);

  // Each series' band sits between the running total *before* it and
  // *after* it — stacked area, so a month's total spend is one glance
  // (the top edge) instead of mentally summing crossing lines.
  const stackedBands = (() => {
    let runningTotals = trendMonths.map(() => 0);
    return visibleSeries.map((s) => {
      const bottoms = runningTotals;
      const tops = trendMonths.map((_, i) => runningTotals[i] + s.values[i]);
      runningTotals = tops;
      return { categoryId: s.categoryId, color: s.color, bottoms, tops };
    });
  })();

  const fittedWidth = Math.max(200, windowWidth - spacing.md * 2 - spacing.md * 2 - Y_AXIS_WIDTH);
  const chartWidth = Math.max(fittedWidth, trendMonths.length * MONTH_WIDTH);
  const chartHeight = 130;
  const pointX = (i: number) => (trendMonths.length > 1 ? (i / (trendMonths.length - 1)) * chartWidth : chartWidth / 2);
  const pointY = (v: number) => chartHeight - (v / maxValue) * (chartHeight - 8) - 4;
  const yTicks = [maxValue, maxValue / 2, 0];

  return (
    <ScreenContainer scroll>
      <MonthNav
        label={formatMonthLabel(month)}
        onPrevious={() => setMonth(previousMonth(month))}
        onNext={() => setMonth(nextMonth(month))}
        onPressLabel={() => setMonthPickerOpen(true)}
      />
      <MonthPickerModal visible={monthPickerOpen} month={month} onSelect={setMonth} onClose={() => setMonthPickerOpen(false)} />

      <View style={styles.card}>
        <Text style={styles.label}>Spending Breakdown</Text>
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
        <Text style={styles.label}>Top Categories</Text>
        {segments.map((seg, i) => (
          <Pressable key={seg.categoryId} style={styles.legendRow} onPress={() => openCategoryTransactions(seg.categoryId)}>
            <View style={styles.legendLeft}>
              <View style={[styles.colorDot, { backgroundColor: i < TOP_N ? SERIES_COLORS[i] : OTHER_COLOR }]} />
              <Text style={styles.legendName}>
                {seg.icon ? `${seg.icon} ` : ''}
                {seg.name}
              </Text>
            </View>
            <Text style={styles.legendValue}>{formatMoney(seg.spentCents)}</Text>
          </Pressable>
        ))}
        {segments.length === 0 ? <Text style={styles.empty}>No spending recorded this month.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Category Trends</Text>
        <Text style={styles.sectionHint}>All time — drag to scroll, tap an icon to hide/show that category.</Text>
        {trend.series.length === 0 ? (
          <Text style={styles.empty}>Not enough history yet.</Text>
        ) : (
          <>
            <View style={styles.trendChartRow}>
              <View style={[styles.yAxis, { height: chartHeight, width: Y_AXIS_WIDTH }]}>
                {yTicks.map((v) => (
                  <Text key={v} style={[styles.yAxisLabel, { top: pointY(v) - 7 }]}>
                    {formatAxisValue(v)}
                  </Text>
                ))}
              </View>
              <ScrollView
                ref={trendScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={() => trendScrollRef.current?.scrollToEnd({ animated: false })}
              >
                <View>
                  <Svg width={chartWidth} height={chartHeight}>
                    {yTicks.map((v) => (
                      <Line key={v} x1={0} y1={pointY(v)} x2={chartWidth} y2={pointY(v)} stroke={colors.border} strokeWidth={1} />
                    ))}
                    {stackedBands.map((band) => (
                      <Polygon
                        key={band.categoryId}
                        points={[
                          ...trendMonths.map((_, i) => `${pointX(i)},${pointY(band.tops[i])}`),
                          ...trendMonths.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${pointY(band.bottoms[arr.length - 1 - i])}`),
                        ].join(' ')}
                        fill={band.color}
                        fillOpacity={0.55}
                      />
                    ))}
                    {stackedBands.map((band) => (
                      <Polyline
                        key={`${band.categoryId}-edge`}
                        points={trendMonths.map((_, i) => `${pointX(i)},${pointY(band.tops[i])}`).join(' ')}
                        fill="none"
                        stroke={band.color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </Svg>
                  <View style={[styles.trendXLabels, { width: chartWidth }]}>
                    {trendMonths.map((m, i) => {
                      // January (or the leftmost tick, if the range starts
                      // mid-year) gets the year appended — otherwise a
                      // multi-year "all time" range reads as one ambiguous
                      // loop of Jan..Dec.
                      const isYearMarker = i === 0 || m.endsWith('-01');
                      return (
                        <Text key={m} style={[styles.trendLabel, isYearMarker && styles.trendLabelYear]}>
                          {isYearMarker ? `${formatMonthShort(m)} ’${m.slice(2, 4)}` : formatMonthShort(m)}
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
                    style={[styles.legendKeyItem, hidden && styles.legendKeyItemHidden]}
                    onPress={() => toggleCategoryVisible(s.categoryId)}
                  >
                    <View style={[styles.legendKeySwatch, { backgroundColor: hidden ? colors.border : s.color }]} />
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

      <View style={styles.card}>
        {TOOL_ROWS.map((row, i) => (
          <Pressable
            key={row.screen}
            style={[styles.toolRow, i < TOOL_ROWS.length - 1 && styles.toolRowDivider]}
            onPress={() => navigation.navigate(row.screen)}
          >
            <Text style={styles.toolRowText}>{row.label}</Text>
            <Text style={styles.toolRowArrow}>›</Text>
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
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  sectionHint: { fontSize: 11, color: colors.textMuted },
  value: { fontSize: 28, fontWeight: '700', color: colors.text },
  negative: { color: colors.negative },
  stackBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' },
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
  yAxisLabel: { position: 'absolute', right: 6, fontSize: 10, color: colors.textMuted },
  trendXLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  trendLabel: { fontSize: 10, color: colors.textMuted },
  trendLabelYear: { fontWeight: '700', color: colors.text },
  legendKey: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legendKeyItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendKeyItemHidden: { opacity: 0.4 },
  legendKeySwatch: { width: 8, height: 8, borderRadius: 2 },
  legendKeyText: { fontSize: 11, color: colors.textMuted },
  toolRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  toolRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  toolRowText: { fontSize: 15, fontWeight: '600', color: colors.text },
  toolRowArrow: { fontSize: 18, color: colors.textMuted },
});
