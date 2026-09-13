import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { PromptModal } from '../../components/ui/PromptModal';
import { MonthPickerModal } from '../../components/ui/MonthPickerModal';
import { MonthNav } from '../../components/ui/MonthNav';
import { AssignedAmountModal } from '../../components/ui/AssignedAmountModal';
import { DisclosureChevron } from '../../components/ui/DisclosureChevron';
import { useBudget } from '../../hooks/useBudget';
import { useAppStore } from '../../state/useAppStore';
import { getDb } from '../../db/client';
import * as categoriesRepo from '../../db/repositories/categoriesRepo';
import * as budgetsRepo from '../../db/repositories/budgetsRepo';
import { nextMonth, previousMonth, lastNMonths, formatMonthLabel } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useI18n, localeTag } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { CategoryStatus } from '../../domain/budgetMath';
import type { CategoryBudgetItem } from '../../hooks/useBudget';
import type { Category, CategoryGroup } from '../../domain/types';
import type { BudgetStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<BudgetStackParamList, 'BudgetHome'>;

const STATUS_COLORS: Record<CategoryStatus, { bg: string; fg: string }> = {
  overspent: { bg: colors.negativeTint, fg: colors.negative },
  'fully-spent': { bg: colors.amberTint, fg: colors.amber },
  funded: { bg: colors.positiveTint, fg: colors.positive },
  unbudgeted: { bg: colors.border, fg: colors.textMuted },
};

type PromptState =
  | { type: 'newGroup' }
  | { type: 'newCategory'; groupId: number }
  | { type: 'renameGroup'; groupId: number; initial: string }
  | { type: 'renameCategory'; categoryId: number; initial: string }
  | null;

export function BudgetScreen() {
  const { t, language } = useI18n();
  const navigation = useNavigation<Nav>();
  const month = useAppStore((s) => s.currentMonth);
  const setMonth = useAppStore((s) => s.setCurrentMonth);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const { groups, itemsByGroup, unassignedCents, setAssigned } = useBudget(month);
  const totalSpentCents = Object.values(itemsByGroup)
    .flat()
    .reduce((sum, item) => sum + Math.max(0, -item.activityThisMonthCents), 0);

  // Feeds the assign popup's "last month" hint.
  const [prevMonthAssignedByCategory, setPrevMonthAssignedByCategory] = useState<Record<number, number>>({});
  useEffect(() => {
    (async () => {
      const db = await getDb();
      setPrevMonthAssignedByCategory(await budgetsRepo.assignedThisMonthByCategory(db, boardId, previousMonth(month)));
    })();
  }, [month, boardId, dataVersion]);

  // Trailing 12 months ending the month before this one, for the top
  // card's compare — an average is more stable than any single prior
  // month (which might've had an unusual one-off expense), and reads as
  // "your typical month" rather than a specific point of comparison.
  const [avgMonthlySpentCents, setAvgMonthlySpentCents] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const months = lastNMonths(previousMonth(month), 12);
      const totals = await budgetsRepo.totalActivityByMonth(db, boardId, months);
      const spentByMonth = months.map((m) => Math.max(0, -(totals[m] ?? 0)));
      setAvgMonthlySpentCents(Math.round(spentByMonth.reduce((sum, v) => sum + v, 0) / spentByMonth.length));
    })();
  }, [month, boardId, dataVersion]);

  const [collapsedGroupIds, setCollapsedGroupIds] = useState<number[]>([]);
  const [editingItem, setEditingItem] = useState<CategoryBudgetItem | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const saveAssigned = (cents: number) => {
    if (!editingItem) return;
    setAssigned(editingItem.category.id, cents);
    setEditingItem(null);
  };

  const openHistory = () => {
    if (!editingItem) return;
    navigation.navigate('Transactions', { categoryId: editingItem.category.id, month });
    setEditingItem(null);
  };

  const toggleGroup = (id: number) => {
    setCollapsedGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitPrompt = async (value: string) => {
    const db = await getDb();
    if (prompt?.type === 'newGroup') await categoriesRepo.createCategoryGroup(db, boardId, value);
    else if (prompt?.type === 'newCategory') await categoriesRepo.createCategory(db, boardId, { groupId: prompt.groupId, name: value, icon: null });
    else if (prompt?.type === 'renameGroup') await categoriesRepo.renameCategoryGroup(db, prompt.groupId, value);
    else if (prompt?.type === 'renameCategory') await categoriesRepo.renameCategory(db, prompt.categoryId, value);
    bumpDataVersion();
    setPrompt(null);
  };

  const deleteGroup = (group: CategoryGroup) => {
    Alert.alert(t('budget.deleteGroupConfirmTitle', { name: group.name }), t('budget.deleteGroupConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await categoriesRepo.archiveCategoryGroup(db, boardId, group.id);
          bumpDataVersion();
        },
      },
    ]);
  };

  const deleteCategory = (category: Category) => {
    Alert.alert(t('budget.deleteCategoryConfirmTitle', { name: category.name }), t('common.cannotBeUndone'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await categoriesRepo.archiveCategory(db, category.id);
          bumpDataVersion();
        },
      },
    ]);
  };

  const moveGroup = async (groupId: number, direction: 'up' | 'down') => {
    const db = await getDb();
    await categoriesRepo.moveCategoryGroup(db, boardId, groupId, direction);
    bumpDataVersion();
  };

  const moveCategory = async (categoryId: number, direction: 'up' | 'down') => {
    const db = await getDb();
    await categoriesRepo.moveCategory(db, boardId, categoryId, direction);
    bumpDataVersion();
  };

  return (
    <ScreenContainer scroll>
      <MonthNav
        label={formatMonthLabel(month, localeTag(language))}
        onPrevious={() => setMonth(previousMonth(month))}
        onNext={() => setMonth(nextMonth(month))}
        onPressLabel={() => setMonthPickerOpen(true)}
      />
      <MonthPickerModal
        visible={monthPickerOpen}
        month={month}
        onSelect={setMonth}
        onClose={() => setMonthPickerOpen(false)}
      />

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>{t('budget.spentThisMonth')}</Text>
          <Text style={styles.summaryValue}>{formatMoney(totalSpentCents)}</Text>
          <Text
            style={[
              styles.unassignedHint,
              { color: unassignedCents < 0 ? colors.negative : unassignedCents > 0 ? colors.positive : colors.textMuted },
            ]}
          >
            {t('budget.unassigned', { amount: formatMoney(unassignedCents) })}
          </Text>
        </View>
        {avgMonthlySpentCents != null ? (
          <View style={styles.compareBlock}>
            <Text style={styles.compareLabel}>{t('budget.avgLabel')}</Text>
            <Text style={styles.compareValue}>{formatMoney(avgMonthlySpentCents)}</Text>
            {avgMonthlySpentCents > 0 ? (
              <Text style={styles.compareDelta}>
                {t('budget.reached', { percent: Math.round((totalSpentCents / avgMonthlySpentCents) * 100) })}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {groups.map((group) => {
        const items = itemsByGroup[group.id] ?? [];
        const collapsed = collapsedGroupIds.includes(group.id);
        const subtotal = items.reduce((s, it) => s + it.balanceCents, 0);

        return (
          <View key={group.id} style={styles.group}>
            <View style={styles.groupHeader}>
              <Pressable style={styles.groupHeaderMain} onPress={() => toggleGroup(group.id)}>
                <DisclosureChevron expanded={!collapsed} size={18} />
                <Text style={styles.groupLabel}>{group.name}</Text>
              </Pressable>
              <Text style={styles.groupSub}>{formatMoney(subtotal)}</Text>
              <RowMenuButton
                items={[
                  { label: t('budget.addCategory'), onPress: () => setPrompt({ type: 'newCategory', groupId: group.id }) },
                  { label: t('budget.renameGroup'), onPress: () => setPrompt({ type: 'renameGroup', groupId: group.id, initial: group.name }) },
                  { label: t('budget.moveUp'), onPress: () => moveGroup(group.id, 'up') },
                  { label: t('budget.moveDown'), onPress: () => moveGroup(group.id, 'down') },
                  { label: t('budget.deleteGroup'), destructive: true, onPress: () => deleteGroup(group) },
                ]}
              />
            </View>
            {collapsed
              ? null
              : items.length === 0
                ? <Text style={styles.emptyGroup}>{t('budget.noCategoriesYet')}</Text>
                : items.map((item) => {
                  const statusColors = STATUS_COLORS[item.status];
                  const spentThisMonth = Math.max(0, -item.activityThisMonthCents);
                  const percentSpent =
                    item.assignedThisMonthCents > 0
                      ? Math.min(100, Math.round((spentThisMonth / item.assignedThisMonthCents) * 100))
                      : spentThisMonth > 0
                        ? 100
                        : 0;

                  return (
                    <Pressable key={item.category.id} style={styles.catRow} onPress={() => setEditingItem(item)}>
                      <View style={styles.catRowTop}>
                        <View style={styles.catNameRow}>
                          {item.category.icon ? <Text style={styles.catIcon}>{item.category.icon}</Text> : null}
                          <Text style={styles.catName}>{item.category.name}</Text>
                        </View>
                        <StatusBadge text={formatMoney(item.balanceCents)} bg={statusColors.bg} fg={statusColors.fg} />
                      </View>
                      <ProgressBar percent={percentSpent} color={statusColors.fg} />
                      <Text style={styles.caption}>{item.captionText}</Text>
                    </Pressable>
                  );
                })}
          </View>
        );
      })}
      <Pressable style={styles.addGroupButton} onPress={() => setPrompt({ type: 'newGroup' })}>
        <Text style={styles.addGroupButtonText}>{t('budget.newGroupButton')}</Text>
      </Pressable>
      <View style={{ height: 80 }} />

      <PromptModal
        visible={prompt != null}
        title={
          prompt?.type === 'newGroup'
            ? t('budget.newGroupTitle')
            : prompt?.type === 'newCategory'
              ? t('budget.newCategoryTitle')
              : prompt?.type === 'renameGroup'
                ? t('budget.renameGroup')
                : t('budget.renameCategory')
        }
        placeholder={prompt?.type === 'newGroup' || prompt?.type === 'renameGroup' ? t('budget.groupNamePlaceholder') : t('budget.categoryNamePlaceholder')}
        initialValue={prompt && 'initial' in prompt ? prompt.initial : ''}
        onCancel={() => setPrompt(null)}
        onSubmit={submitPrompt}
      />

      <AssignedAmountModal
        visible={editingItem != null}
        categoryName={editingItem?.category.name ?? ''}
        categoryIcon={editingItem?.category.icon ?? null}
        initialCents={editingItem?.assignedThisMonthCents ?? 0}
        unassignedCents={unassignedCents}
        lastMonthAssignedCents={editingItem ? (prevMonthAssignedByCategory[editingItem.category.id] ?? 0) : 0}
        rolloverCents={editingItem ? editingItem.balanceCents - editingItem.assignedThisMonthCents - editingItem.activityThisMonthCents : 0}
        menuItems={
          editingItem
            ? [
                {
                  label: t('common.rename'),
                  onPress: () => {
                    setEditingItem(null);
                    setPrompt({ type: 'renameCategory', categoryId: editingItem.category.id, initial: editingItem.category.name });
                  },
                },
                { label: t('budget.moveUp'), onPress: () => moveCategory(editingItem.category.id, 'up') },
                { label: t('budget.moveDown'), onPress: () => moveCategory(editingItem.category.id, 'down') },
                {
                  label: t('common.delete'),
                  destructive: true,
                  onPress: () => {
                    setEditingItem(null);
                    deleteCategory(editingItem.category);
                  },
                },
              ]
            : []
        }
        onSave={saveAssigned}
        onHistory={openHistory}
        onClose={() => setEditingItem(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
  },
  compareBlock: { alignItems: 'flex-end' },
  // Sized to match summaryLabel/summaryValue/unassignedHint line for line,
  // so the two halves' three rows land at the same height instead of the
  // right half reading visually shorter.
  compareLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  compareValue: { fontSize: 26, fontWeight: '700', color: colors.textMuted, marginTop: 4 },
  compareDelta: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  summaryLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  summaryValue: { fontSize: 30, fontWeight: '700', marginTop: 4, color: colors.text },
  unassignedHint: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  group: { gap: spacing.xs },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  groupHeaderMain: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  groupSub: { marginLeft: 'auto', fontSize: 12, fontWeight: '700', color: colors.textMuted },
  emptyGroup: { fontSize: 12, color: colors.textMuted, paddingHorizontal: 2 },
  catRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: 2, gap: spacing.xs },
  catRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  catIcon: { fontSize: 17 },
  catName: { fontSize: 15, fontWeight: '600', color: colors.text },
  caption: { fontSize: 11, color: colors.textMuted },
  addGroupButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    borderStyle: 'dashed',
  },
  addGroupButtonText: { color: colors.accent, fontWeight: '700' },
});
