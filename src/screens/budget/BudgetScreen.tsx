import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { categoryBarSegments } from '../../domain/budgetMath';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { PromptModal } from '../../components/ui/PromptModal';
import { MonthNav } from '../../components/ui/MonthNav';
import { CategoryAssignPanel } from './CategoryAssignPanel';
import { DisclosureChevron } from '../../components/ui/DisclosureChevron';
import { PendingScheduledTransactionsModal } from '../../components/ui/PendingScheduledTransactionsModal';
import { useBudget } from '../../hooks/useBudget';
import { usePendingScheduledTransactions } from '../../hooks/usePendingScheduledTransactions';
import { useAppStore } from '../../state/useAppStore';
import { getDb } from '../../db/client';
import * as categoriesRepo from '../../db/repositories/categoriesRepo';
import * as budgetsRepo from '../../db/repositories/budgetsRepo';
import {
  nextMonth,
  previousMonth,
  lastNMonths,
  formatMonthLabel,
} from '../../domain/month';
import { formatMoney, formatMoneyExact } from '../../domain/money';
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
  // Nothing left is not a warning — the envelope did its job. It reads
  // neutral, the same as one with nothing budgeted, leaving red for
  // overspent and green for money still there.
  'fully-spent': { bg: colors.border, fg: colors.textMuted },
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
  const { groups, itemsByGroup, unassignedCents, breakdown, setAssigned } =
    useBudget(month);
  const totalSpentCents = Object.values(itemsByGroup)
    .flat()
    .reduce((sum, item) => sum + Math.max(0, -item.activityThisMonthCents), 0);
  const { pending, approve } = usePendingScheduledTransactions();
  const [pendingModalOpen, setPendingModalOpen] = useState(false);

  // Feeds the assign popup's "last month" hint.
  const [prevMonthAssignedByCategory, setPrevMonthAssignedByCategory] =
    useState<Record<number, number>>({});
  useEffect(() => {
    (async () => {
      const db = await getDb();
      setPrevMonthAssignedByCategory(
        await budgetsRepo.assignedThisMonthByCategory(
          db,
          boardId,
          previousMonth(month),
        ),
      );
    })();
  }, [month, boardId, dataVersion]);

  // Trailing 12 months ending the month before this one, for the top
  // card's compare — an average is more stable than any single prior
  // month (which might've had an unusual one-off expense), and reads as
  // "your typical month" rather than a specific point of comparison.
  const [avgMonthlySpentCents, setAvgMonthlySpentCents] = useState<
    number | null
  >(null);
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const months = lastNMonths(previousMonth(month), 12);
      const totals = await budgetsRepo.totalActivityByMonth(
        db,
        boardId,
        months,
      );
      const spentByMonth = months.map((m) => Math.max(0, -(totals[m] ?? 0)));
      setAvgMonthlySpentCents(
        Math.round(
          spentByMonth.reduce((sum, v) => sum + v, 0) / spentByMonth.length,
        ),
      );
    })();
  }, [month, boardId, dataVersion]);

  const scrollRef = useRef<ScrollView>(null);
  // Where each group sits in the scroll content, and where each row sits in
  // its group — added together, that is the row's offset from the top of the
  // page. Taken from onLayout rather than a native measuring pass: the
  // groups are direct children of the scroll's content view, so the two
  // numbers compose exactly, and there is no ref to go stale.
  const groupYs = useRef(new Map<number, number>());
  const rowBoxes = useRef(new Map<number, { y: number; height: number }>());
  const viewportHeight = useRef(0);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<number[]>([]);
  const [editingItem, setEditingItem] = useState<CategoryBudgetItem | null>(
    null,
  );
  const [prompt, setPrompt] = useState<PromptState>(null);

  const saveAssigned = (cents: number) => {
    if (!editingItem) return;
    setAssigned(editingItem.category.id, cents);
    setEditingItem(null);
  };

  // Renaming and deleting a category are things you do to the category, not
  // to its money — they live behind the panel's "⋯" rather than beside the
  // controls for assigning.
  const categoryMenuItems = (item: CategoryBudgetItem) => [
    {
      label: t('common.rename'),
      onPress: () => {
        setEditingItem(null);
        setPrompt({
          type: 'renameCategory',
          categoryId: item.category.id,
          initial: item.category.name,
        });
      },
    },
    {
      label: t('common.delete'),
      destructive: true,
      onPress: () => {
        setEditingItem(null);
        deleteCategory(item.category);
      },
    },
  ];

  const revealRow = (groupId: number, categoryId: number) => {
    const groupY = groupYs.current.get(groupId);
    const row = rowBoxes.current.get(categoryId);
    const viewport = viewportHeight.current;
    if (groupY == null || row == null || viewport === 0) return;
    // The panel's *bottom* goes to the bottom of the screen, not the row to
    // the top: what you reach for once it opens is the pad, and parking the
    // row up at the top leaves that pad stretched down at arm's length.
    const bottom = groupY + row.y + row.height;
    scrollRef.current?.scrollTo({
      y: Math.max(0, bottom - viewport + spacing.md),
      animated: true,
    });
  };

  const openHistory = () => {
    if (!editingItem) return;
    navigation.navigate('Transactions', {
      categoryId: editingItem.category.id,
      month,
    });
    setEditingItem(null);
  };

  const toggleGroup = (id: number) => {
    setCollapsedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submitPrompt = async (value: string) => {
    const db = await getDb();
    if (prompt?.type === 'newGroup')
      await categoriesRepo.createCategoryGroup(db, boardId, value);
    else if (prompt?.type === 'newCategory')
      await categoriesRepo.createCategory(db, boardId, {
        groupId: prompt.groupId,
        name: value,
        icon: null,
      });
    else if (prompt?.type === 'renameGroup')
      await categoriesRepo.renameCategoryGroup(db, prompt.groupId, value);
    else if (prompt?.type === 'renameCategory')
      await categoriesRepo.renameCategory(db, prompt.categoryId, value);
    bumpDataVersion();
    setPrompt(null);
  };

  const deleteGroup = (group: CategoryGroup) => {
    Alert.alert(
      t('budget.deleteGroupConfirmTitle', { name: group.name }),
      t('budget.deleteGroupConfirmMessage'),
      [
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
      ],
    );
  };

  const deleteCategory = (category: Category) => {
    Alert.alert(
      t('budget.deleteCategoryConfirmTitle', { name: category.name }),
      t('common.cannotBeUndone'),
      [
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
      ],
    );
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
    <ScreenContainer
      scroll
      scrollRef={scrollRef}
      onScrollViewLayout={(e) => {
        viewportHeight.current = e.nativeEvent.layout.height;
      }}
    >
      <MonthNav
        label={formatMonthLabel(month, localeTag(language))}
        onPrevious={() => setMonth(previousMonth(month))}
        onNext={() => setMonth(nextMonth(month))}
        month={month}
        onSelect={setMonth}
      />
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>{t('budget.spentThisMonth')}</Text>
          <Text style={styles.summaryValue}>
            {formatMoney(totalSpentCents)}
          </Text>
          {/* Tappable: this is cash you hold *today* against every month's
              assignments, so it reads the same whichever month is on screen
              — which is not what the word sounds like next to a month
              picker. The arithmetic under it is the only way to tell. */}
          <Pressable onPress={() => setBreakdownOpen((v) => !v)} hitSlop={6}>
            <Text
              style={[
                styles.unassignedHint,
                {
                  color:
                    unassignedCents < 0
                      ? colors.negative
                      : unassignedCents > 0
                        ? colors.positive
                        : colors.textMuted,
                },
              ]}
            >
              {t('budget.unassigned', { amount: formatMoney(unassignedCents) })}
              {breakdownOpen ? ' ▴' : ' ▾'}
            </Text>
          </Pressable>
        </View>
        {avgMonthlySpentCents != null ? (
          <View style={styles.compareBlock}>
            <Text style={styles.compareLabel}>{t('budget.avgLabel')}</Text>
            <Text style={styles.compareValue}>
              {formatMoney(avgMonthlySpentCents)}
            </Text>
            {avgMonthlySpentCents > 0 ? (
              <Text style={styles.compareDelta}>
                {t('budget.reached', {
                  percent: Math.round(
                    (totalSpentCents / avgMonthlySpentCents) * 100,
                  ),
                })}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {breakdownOpen && breakdown != null ? (
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>
              {t('budget.breakdownCash')}
            </Text>
            <Text style={styles.breakdownValue}>
              {formatMoney(breakdown.cashCents)}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>
              {t('budget.breakdownEnvelopes')}
            </Text>
            <Text style={styles.breakdownValue}>
              {`−${formatMoney(breakdown.envelopesCents)}`}
            </Text>
          </View>
          {breakdown.assignedAheadCents !== 0 ? (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                {t('budget.breakdownAhead')}
              </Text>
              <Text style={styles.breakdownValue}>
                {formatMoney(breakdown.assignedAheadCents)}
              </Text>
            </View>
          ) : null}
          <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
            <Text style={styles.breakdownTotalLabel}>
              {t('budget.breakdownUnassigned')}
            </Text>
            <Text style={styles.breakdownTotalValue}>
              {formatMoney(breakdown.unassignedCents)}
            </Text>
          </View>
          <Text style={styles.breakdownNote}>{t('budget.breakdownNote')}</Text>
          {breakdown.cardDebtCents > 0 ? (
            <Text style={styles.breakdownWarning}>
              {t('budget.breakdownCardWarning', {
                amount: formatMoney(breakdown.cardDebtCents),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {pending.length > 0 ? (
        <Pressable
          style={styles.pendingBanner}
          onPress={() => setPendingModalOpen(true)}
        >
          <Text style={styles.pendingBannerText}>
            {t('budget.pendingApprovals', { count: String(pending.length) })}
          </Text>
          <DisclosureChevron expanded={false} />
        </Pressable>
      ) : null}
      <PendingScheduledTransactionsModal
        visible={pendingModalOpen}
        items={pending}
        onApprove={approve}
        onClose={() => setPendingModalOpen(false)}
      />

      {groups.map((group) => {
        const items = itemsByGroup[group.id] ?? [];
        const collapsed = collapsedGroupIds.includes(group.id);
        const subtotal = items.reduce((s, it) => s + it.balanceCents, 0);

        return (
          <View
            key={group.id}
            style={styles.group}
            onLayout={(e) =>
              groupYs.current.set(group.id, e.nativeEvent.layout.y)
            }
          >
            <View style={styles.groupHeader}>
              <Pressable
                style={styles.groupHeaderMain}
                onPress={() => toggleGroup(group.id)}
              >
                <DisclosureChevron expanded={!collapsed} size={18} />
                <Text style={styles.groupLabel}>{group.name}</Text>
              </Pressable>
              <Text style={styles.groupSub}>{formatMoneyExact(subtotal)}</Text>
              <RowMenuButton
                items={[
                  {
                    label: t('budget.addCategory'),
                    onPress: () =>
                      setPrompt({ type: 'newCategory', groupId: group.id }),
                  },
                  {
                    label: t('budget.renameGroup'),
                    onPress: () =>
                      setPrompt({
                        type: 'renameGroup',
                        groupId: group.id,
                        initial: group.name,
                      }),
                  },
                  {
                    label: t('budget.moveUp'),
                    onPress: () => moveGroup(group.id, 'up'),
                  },
                  {
                    label: t('budget.moveDown'),
                    onPress: () => moveGroup(group.id, 'down'),
                  },
                  {
                    label: t('budget.deleteGroup'),
                    destructive: true,
                    onPress: () => deleteGroup(group),
                  },
                ]}
              />
            </View>
            {collapsed ? null : items.length === 0 ? (
              <Text style={styles.emptyGroup}>
                {t('budget.noCategoriesYet')}
              </Text>
            ) : (
              items.map((item) => {
                const statusColors = STATUS_COLORS[item.status];
                const spentThisMonth = Math.max(
                  0,
                  -item.activityThisMonthCents,
                );
                const { spentPercent, remainingPercent } = categoryBarSegments(
                  item.balanceCents,
                  spentThisMonth,
                );
                // Overspent has no remainder to show, so it reads as one
                // red run rather than a split; unbudgeted has nothing at
                // all and leaves the bare track.
                const barSegments =
                  item.status === 'overspent'
                    ? [{ percent: 100, color: statusColors.fg }]
                    : [
                        // What is still in the envelope leads in solid
                        // green, and the spent share trails it faded — one
                        // colour in two weights, reading as how much is
                        // left rather than how far along you are.
                        { percent: remainingPercent, color: colors.positive },
                        { percent: spentPercent, color: colors.positiveFaded },
                      ];

                const expanded = editingItem?.category.id === item.category.id;

                return (
                  <View
                    key={item.category.id}
                    onLayout={(e) => {
                      const { y, height } = e.nativeEvent.layout;
                      rowBoxes.current.set(item.category.id, { y, height });
                      // Fires again when the panel opens and the row grows,
                      // which is the moment there is something to reveal.
                      if (expanded) revealRow(group.id, item.category.id);
                    }}
                  >
                    <Pressable
                      style={styles.catRow}
                      onPress={() => setEditingItem(expanded ? null : item)}
                    >
                      <View style={styles.catRowTop}>
                        <View style={styles.catNameRow}>
                          {item.category.icon ? (
                            <Text style={styles.catIcon}>
                              {item.category.icon}
                            </Text>
                          ) : null}
                          <Text style={styles.catName}>
                            {item.category.name}
                          </Text>
                        </View>
                        <StatusBadge
                          text={formatMoneyExact(item.balanceCents)}
                          bg={statusColors.bg}
                          fg={statusColors.fg}
                        />
                      </View>
                      <ProgressBar segments={barSegments} />
                      <Text style={styles.caption}>{item.captionText}</Text>
                    </Pressable>
                    {expanded ? (
                      <CategoryAssignPanel
                        initialCents={item.assignedThisMonthCents}
                        activityCents={item.activityThisMonthCents}
                        unassignedCents={unassignedCents}
                        lastMonthAssignedCents={
                          prevMonthAssignedByCategory[item.category.id] ?? 0
                        }
                        rolloverCents={
                          item.balanceCents -
                          item.assignedThisMonthCents -
                          item.activityThisMonthCents
                        }
                        onSave={saveAssigned}
                        onCancel={() => setEditingItem(null)}
                        onHistory={openHistory}
                        onMove={(direction) =>
                          moveCategory(item.category.id, direction)
                        }
                        menuItems={categoryMenuItems(item)}
                        onLaidOut={() => revealRow(group.id, item.category.id)}
                      />
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        );
      })}
      <Pressable
        style={styles.addGroupButton}
        onPress={() => setPrompt({ type: 'newGroup' })}
      >
        <Text style={styles.addGroupButtonText}>
          {t('budget.newGroupButton')}
        </Text>
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
        placeholder={
          prompt?.type === 'newGroup' || prompt?.type === 'renameGroup'
            ? t('budget.groupNamePlaceholder')
            : t('budget.categoryNamePlaceholder')
        }
        initialValue={prompt && 'initial' in prompt ? prompt.initial : ''}
        onCancel={() => setPrompt(null)}
        onSubmit={submitPrompt}
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
  breakdownCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: 6,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    marginTop: 2,
  },
  breakdownLabel: { fontSize: 13, color: colors.textMuted },
  breakdownValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
  breakdownTotalLabel: { fontSize: 13, color: colors.text, fontWeight: '700' },
  breakdownTotalValue: { fontSize: 13, color: colors.text, fontWeight: '700' },
  breakdownNote: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 2,
  },
  breakdownWarning: { fontSize: 12, color: colors.negative, lineHeight: 17 },
  // Sized to match summaryLabel/summaryValue/unassignedHint line for line,
  // so the two halves' three rows land at the same height instead of the
  // right half reading visually shorter.
  compareLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  compareValue: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 4,
  },
  compareDelta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: '700',
    marginTop: 4,
    color: colors.text,
  },
  unassignedHint: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.amberTint,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  pendingBannerText: { color: colors.amber, fontWeight: '700', fontSize: 13 },
  group: { gap: spacing.xs },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  groupHeaderMain: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  groupSub: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  emptyGroup: { fontSize: 12, color: colors.textMuted, paddingHorizontal: 2 },
  catRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    gap: spacing.xs,
  },
  catRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
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
