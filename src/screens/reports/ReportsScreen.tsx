import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useReports } from '../../hooks/useReports';
import { useAppStore } from '../../state/useAppStore';
import { formatMoney } from '../../domain/money';
import { formatMonthLabel, formatMonthShort } from '../../domain/month';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const PALETTE = ['#0F766E', '#2563EB', '#B45309', '#7C3AED', '#DB2777', '#6B7280'];

export function ReportsScreen() {
  const month = useAppStore((s) => s.currentMonth);
  const { spending, trend, interestCents } = useReports(month);

  const totalSpentCents = spending.reduce((s, c) => s + c.spentCents, 0);
  const top = spending.slice(0, 5);
  const otherCents = spending.slice(5).reduce((s, c) => s + c.spentCents, 0);
  const segments =
    otherCents > 0 ? [...top, { categoryId: -1, name: 'All Others', icon: null, spentCents: otherCents }] : top;

  const maxTrendValue = Math.max(1, ...trend.flatMap((m) => [m.incomeCents, m.spendingCents]));
  const lastMonth = trend[trend.length - 1];
  const insight = !lastMonth
    ? ''
    : lastMonth.spendingCents > lastMonth.incomeCents
      ? "You're spending more than you earn this month."
      : lastMonth.spendingCents < lastMonth.incomeCents * 0.9
        ? "You're spending comfortably less than you earn this month."
        : "You're spending about as much as you make.";

  return (
    <ScreenContainer scroll>
      <View style={styles.card}>
        <Text style={styles.label}>Spending — {formatMonthLabel(month)}</Text>
        <Text style={styles.value}>{formatMoney(totalSpentCents)}</Text>
        <View style={styles.stackBar}>
          {segments.map((seg, i) => (
            <View
              key={seg.categoryId}
              style={{
                width: `${totalSpentCents > 0 ? (seg.spentCents / totalSpentCents) * 100 : 0}%`,
                backgroundColor: PALETTE[i % PALETTE.length],
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
              <View style={[styles.colorDot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
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
        <Text style={styles.label}>Income vs. Spending</Text>
        {insight ? <Text style={styles.insight}>{insight}</Text> : null}
        <View style={styles.trendChart}>
          {trend.map((m) => (
            <View key={m.month} style={styles.trendCol}>
              <View style={styles.trendBars}>
                <View
                  style={[styles.trendBar, { height: (m.incomeCents / maxTrendValue) * 90, backgroundColor: colors.positive }]}
                />
                <View
                  style={[styles.trendBar, { height: (m.spendingCents / maxTrendValue) * 90, backgroundColor: colors.accent }]}
                />
              </View>
              <Text style={styles.trendLabel}>{formatMonthShort(m.month)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.legendKey}>
          <View style={styles.legendKeyItem}>
            <View style={[styles.legendKeySwatch, { backgroundColor: colors.positive }]} />
            <Text style={styles.legendKeyText}>Income</Text>
          </View>
          <View style={styles.legendKeyItem}>
            <View style={[styles.legendKeySwatch, { backgroundColor: colors.accent }]} />
            <Text style={styles.legendKeyText}>Spending</Text>
          </View>
        </View>
      </View>

      {interestCents > 0 ? (
        <View style={styles.card}>
          <Text style={styles.label}>Interest Earned — {formatMonthLabel(month)}</Text>
          <Text style={[styles.value, { color: colors.positive }]}>{formatMoney(interestCents)}</Text>
        </View>
      ) : null}
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
  value: { fontSize: 28, fontWeight: '700', color: colors.text },
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
  insight: { fontSize: 14, color: colors.text, lineHeight: 20 },
  trendChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, height: 110 },
  trendCol: { alignItems: 'center', gap: 4, flex: 1 },
  trendBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 90 },
  trendBar: { width: 12, borderRadius: 3 },
  trendLabel: { fontSize: 10, color: colors.textMuted },
  legendKey: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
  legendKeyItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendKeySwatch: { width: 8, height: 8, borderRadius: 2 },
  legendKeyText: { fontSize: 11, color: colors.textMuted },
});
