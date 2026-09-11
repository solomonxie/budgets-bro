import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useInsights } from '../../hooks/useInsights';
import { useAccounts } from '../../hooks/useAccounts';
import { netWorth as computeNetWorth } from '../../domain/accountKind';
import { currentMonth, nextMonth, previousMonth, formatMonthLabel, formatMonthShort } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { InsightsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<InsightsStackParamList, 'InsightsHome'>;
type ToolScreen = 'BabySteps' | 'TaxInsights' | 'Calculators' | 'AiAnalysis' | 'YnabImport';

const TOOL_ROWS: { label: string; screen: ToolScreen }[] = [
  { label: 'Baby Steps', screen: 'BabySteps' },
  { label: 'Tax Insights', screen: 'TaxInsights' },
  { label: 'Calculators', screen: 'Calculators' },
  { label: 'AI Analysis', screen: 'AiAnalysis' },
  { label: 'Import from YNAB', screen: 'YnabImport' },
];

// Validated categorical palette (dataviz skill), dark-surface steps — fixed
// order, never cycled.
const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const OTHER_COLOR = colors.textMuted;
const TOP_N = 5;

export function InsightsScreen() {
  const navigation = useNavigation<Nav>();
  const [month, setMonth] = useState(currentMonth());
  const { spending, trendPoints, trendMonths } = useInsights(month);
  const { accounts } = useAccounts();
  const { width: windowWidth } = useWindowDimensions();

  const netWorth = useMemo(
    () => computeNetWorth(accounts.map((a) => ({ type: a.account.type, balanceCents: a.balanceCents }))),
    [accounts],
  );

  const totalSpentCents = spending.reduce((s, c) => s + c.spentCents, 0);
  const top = spending.slice(0, TOP_N);
  const otherCents = spending.slice(TOP_N).reduce((s, c) => s + c.spentCents, 0);
  const segments = otherCents > 0 ? [...top, { categoryId: -1, name: 'All Others', icon: null, spentCents: otherCents }] : top;

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
    const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
    return { series, maxValue };
  }, [trendPoints, trendMonths]);

  const chartWidth = Math.max(200, windowWidth - spacing.md * 2 - spacing.md * 2);
  const chartHeight = 130;
  const pointX = (i: number) => (trendMonths.length > 1 ? (i / (trendMonths.length - 1)) * chartWidth : chartWidth / 2);
  const pointY = (v: number) => chartHeight - (v / trend.maxValue) * (chartHeight - 8) - 4;

  return (
    <ScreenContainer scroll>
      <View style={styles.monthNav}>
        <Pressable onPress={() => setMonth(previousMonth(month))} hitSlop={10}>
          <Text style={styles.monthArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
        <Pressable onPress={() => setMonth(nextMonth(month))} hitSlop={10}>
          <Text style={styles.monthArrow}>›</Text>
        </Pressable>
      </View>

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
          <View key={seg.categoryId} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.colorDot, { backgroundColor: i < TOP_N ? SERIES_COLORS[i] : OTHER_COLOR }]} />
              <Text style={styles.legendName}>
                {seg.icon ? `${seg.icon} ` : ''}
                {seg.name}
              </Text>
            </View>
            <Text style={styles.legendValue}>{formatMoney(seg.spentCents)}</Text>
          </View>
        ))}
        {segments.length === 0 ? <Text style={styles.empty}>No spending recorded this month.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Category Trends</Text>
        {trend.series.length === 0 ? (
          <Text style={styles.empty}>Not enough history yet.</Text>
        ) : (
          <>
            <Svg width={chartWidth} height={chartHeight}>
              <Line x1={0} y1={chartHeight - 4} x2={chartWidth} y2={chartHeight - 4} stroke={colors.border} strokeWidth={1} />
              {trend.series.map((s) => (
                <Polyline
                  key={s.categoryId}
                  points={s.values.map((v, i) => `${pointX(i)},${pointY(v)}`).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {trend.series.map((s) =>
                s.values.map((v, i) => (
                  <Circle key={`${s.categoryId}-${i}`} cx={pointX(i)} cy={pointY(v)} r={3} fill={s.color} />
                )),
              )}
            </Svg>
            <View style={styles.trendXLabels}>
              {trendMonths.map((m) => (
                <Text key={m} style={styles.trendLabel}>
                  {formatMonthShort(m)}
                </Text>
              ))}
            </View>
            <View style={styles.legendKey}>
              {trend.series.map((s) => (
                <View key={s.categoryId} style={styles.legendKeyItem}>
                  <View style={[styles.legendKeySwatch, { backgroundColor: s.color }]} />
                  <Text style={styles.legendKeyText}>
                    {s.icon ? `${s.icon} ` : ''}
                    {s.name}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Net Worth</Text>
        <Text style={[styles.value, netWorth.netWorthCents < 0 && styles.negative]}>{formatMoney(netWorth.netWorthCents)}</Text>
        <View style={styles.netWorthBreakdown}>
          <Text style={styles.netWorthPart}>Assets {formatMoney(netWorth.assetsCents)}</Text>
          <Text style={styles.netWorthPart}>Debts {formatMoney(netWorth.debtsCents)}</Text>
        </View>
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
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  monthArrow: { fontSize: 22, color: colors.accent, fontWeight: '700', paddingHorizontal: 6 },
  monthLabel: { fontSize: 15, fontWeight: '600', color: colors.textMuted, minWidth: 150, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  value: { fontSize: 28, fontWeight: '700', color: colors.text },
  negative: { color: colors.negative },
  netWorthBreakdown: { flexDirection: 'row', gap: spacing.md },
  netWorthPart: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
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
  trendXLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  trendLabel: { fontSize: 10, color: colors.textMuted },
  legendKey: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legendKeyItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendKeySwatch: { width: 8, height: 8, borderRadius: 2 },
  legendKeyText: { fontSize: 11, color: colors.textMuted },
  toolRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  toolRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  toolRowText: { fontSize: 15, fontWeight: '600', color: colors.text },
  toolRowArrow: { fontSize: 18, color: colors.textMuted },
});
