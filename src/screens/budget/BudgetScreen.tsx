import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useBudget } from '../../hooks/useBudget';
import { useAppStore } from '../../state/useAppStore';
import { nextMonth, previousMonth, formatMonthLabel } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { CategoryStatus } from '../../domain/budgetMath';

const STATUS_COLORS: Record<CategoryStatus, { bg: string; fg: string }> = {
  overspent: { bg: colors.negativeTint, fg: colors.negative },
  'fully-spent': { bg: colors.amberTint, fg: colors.amber },
  funded: { bg: colors.positiveTint, fg: colors.positive },
  unbudgeted: { bg: colors.border, fg: colors.textMuted },
};

export function BudgetScreen() {
  const month = useAppStore((s) => s.currentMonth);
  const setMonth = useAppStore((s) => s.setCurrentMonth);
  const { groups, itemsByGroup, unassignedCents, adjustAssigned } = useBudget(month);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<number[]>([]);
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(null);

  const toggleGroup = (id: number) => {
    setCollapsedGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

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

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Unassigned Cash</Text>
        <Text style={[styles.summaryValue, { color: unassignedCents < 0 ? colors.negative : unassignedCents > 0 ? colors.positive : colors.textMuted }]}>
          {formatMoney(unassignedCents)}
        </Text>
      </View>

      {groups.map((group) => {
        const items = itemsByGroup[group.id] ?? [];
        if (items.length === 0) return null;
        const collapsed = collapsedGroupIds.includes(group.id);
        const subtotal = items.reduce((s, it) => s + it.balanceCents, 0);

        return (
          <View key={group.id} style={styles.group}>
            <Pressable style={styles.groupHeader} onPress={() => toggleGroup(group.id)}>
              <Text style={styles.chevron}>{collapsed ? '›' : '⌄'}</Text>
              <Text style={styles.groupLabel}>{group.name}</Text>
              <Text style={styles.groupSub}>{formatMoney(subtotal)}</Text>
            </Pressable>
            {collapsed
              ? null
              : items.map((item) => {
                  const statusColors = STATUS_COLORS[item.status];
                  const expanded = expandedCategoryId === item.category.id;
                  const spentThisMonth = Math.max(0, -item.activityThisMonthCents);
                  const percentSpent =
                    item.assignedThisMonthCents > 0
                      ? Math.min(100, Math.round((spentThisMonth / item.assignedThisMonthCents) * 100))
                      : spentThisMonth > 0
                        ? 100
                        : 0;

                  return (
                    <View
                      key={item.category.id}
                      style={[styles.catRow, { borderColor: expanded ? colors.accent : colors.border, backgroundColor: expanded ? colors.tint : colors.surface }]}
                    >
                      <Pressable
                        style={styles.catRowTop}
                        onPress={() => setExpandedCategoryId(expanded ? null : item.category.id)}
                      >
                        <View style={styles.catNameRow}>
                          {item.category.icon ? <Text style={styles.catIcon}>{item.category.icon}</Text> : null}
                          <Text style={styles.catName}>{item.category.name}</Text>
                        </View>
                        <StatusBadge text={formatMoney(item.balanceCents)} bg={statusColors.bg} fg={statusColors.fg} />
                      </Pressable>
                      <ProgressBar percent={percentSpent} color={statusColors.fg} />
                      <Text style={styles.caption}>{item.captionText}</Text>
                      {expanded ? (
                        <View style={styles.quickAssign}>
                          <Pressable style={styles.stepBtn} onPress={() => adjustAssigned(item.category.id, -1000)}>
                            <Text style={styles.stepBtnText}>–</Text>
                          </Pressable>
                          <Text style={styles.stepValue}>{formatMoney(item.assignedThisMonthCents)}</Text>
                          <Pressable style={styles.stepBtn} onPress={() => adjustAssigned(item.category.id, 1000)}>
                            <Text style={styles.stepBtnText}>+</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
          </View>
        );
      })}
      <View style={{ height: 80 }} />
      <FloatingAddButton />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  monthArrow: { fontSize: 22, color: colors.accent, fontWeight: '700', paddingHorizontal: 6 },
  monthLabel: { fontSize: 15, fontWeight: '600', color: colors.textMuted, minWidth: 150, textAlign: 'center' },
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  summaryValue: { fontSize: 30, fontWeight: '700', marginTop: 4 },
  group: { gap: spacing.xs },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  chevron: { color: colors.textMuted, width: 14 },
  groupLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  groupSub: { marginLeft: 'auto', fontSize: 12, fontWeight: '700', color: colors.textMuted },
  catRow: { borderWidth: 1, borderRadius: 14, padding: spacing.sm, gap: spacing.xs },
  catRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catIcon: { fontSize: 17 },
  catName: { fontSize: 15, fontWeight: '600', color: colors.text },
  caption: { fontSize: 11, color: colors.textMuted },
  quickAssign: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, fontWeight: '600', color: colors.text },
  stepValue: { fontSize: 16, fontWeight: '700', minWidth: 74, textAlign: 'center', color: colors.text },
});
