import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { PromptModal } from '../../components/ui/PromptModal';
import { MonthPickerModal } from '../../components/ui/MonthPickerModal';
import { AssignedAmountModal } from '../../components/ui/AssignedAmountModal';
import { LinkAccountModal } from '../../components/ui/LinkAccountModal';
import { useBudget } from '../../hooks/useBudget';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useAppStore } from '../../state/useAppStore';
import { getDb } from '../../db/client';
import * as categoriesRepo from '../../db/repositories/categoriesRepo';
import { isLoanLikeType } from '../../domain/accountKind';
import { nextMonth, previousMonth, formatMonthLabel } from '../../domain/month';
import { formatMoney } from '../../domain/money';
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
  const navigation = useNavigation<Nav>();
  const month = useAppStore((s) => s.currentMonth);
  const setMonth = useAppStore((s) => s.setCurrentMonth);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { groups, itemsByGroup, unassignedCents, setAssigned, moveToUnassigned } = useBudget(month);
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<number[]>([]);
  const [editingItem, setEditingItem] = useState<CategoryBudgetItem | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

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

  // Loan/mortgage accounts not already linked to some other category —
  // the current category's own link (if any) stays selectable/checked.
  const eligibleLinkAccounts = useMemo(() => {
    const linkedElsewhere = new Set(
      categories.filter((c) => c.linkedAccountId != null && c.id !== editingItem?.category.id).map((c) => c.linkedAccountId),
    );
    return accounts
      .filter((a) => isLoanLikeType(a.account.type) && !linkedElsewhere.has(a.account.id))
      .map((a) => ({ id: a.account.id, name: a.account.name }));
  }, [accounts, categories, editingItem]);

  const linkToAccount = async (accountId: number) => {
    if (!editingItem) return;
    const db = await getDb();
    await categoriesRepo.linkCategoryToAccount(db, editingItem.category.id, accountId);
    bumpDataVersion();
    setLinkModalOpen(false);
    setEditingItem(null);
  };

  const unlinkAccount = async () => {
    if (!editingItem) return;
    const db = await getDb();
    await categoriesRepo.unlinkCategory(db, editingItem.category.id);
    bumpDataVersion();
    setLinkModalOpen(false);
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
    Alert.alert(`Delete "${group.name}"?`, 'Its categories will be deleted too. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await categoriesRepo.archiveCategoryGroup(db, group.id);
          bumpDataVersion();
        },
      },
    ]);
  };

  const deleteCategory = (category: Category) => {
    Alert.alert(`Delete "${category.name}"?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
    <ScreenContainer scroll floating={<FloatingAddButton />}>
      <View style={styles.monthNav}>
        <Pressable onPress={() => setMonth(previousMonth(month))} hitSlop={10}>
          <Text style={styles.monthArrow}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setMonthPickerOpen(true)} hitSlop={10}>
          <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
        </Pressable>
        <Pressable onPress={() => setMonth(nextMonth(month))} hitSlop={10}>
          <Text style={styles.monthArrow}>›</Text>
        </Pressable>
      </View>
      <MonthPickerModal
        visible={monthPickerOpen}
        month={month}
        onSelect={setMonth}
        onClose={() => setMonthPickerOpen(false)}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Unassigned Cash</Text>
        <Text style={[styles.summaryValue, { color: unassignedCents < 0 ? colors.negative : unassignedCents > 0 ? colors.positive : colors.textMuted }]}>
          {formatMoney(unassignedCents)}
        </Text>
      </View>

      {groups.map((group) => {
        const items = itemsByGroup[group.id] ?? [];
        const collapsed = collapsedGroupIds.includes(group.id);
        const subtotal = items.reduce((s, it) => s + it.balanceCents, 0);

        return (
          <View key={group.id} style={styles.group}>
            <View style={styles.groupHeader}>
              <Pressable style={styles.groupHeaderMain} onPress={() => toggleGroup(group.id)}>
                <Text style={styles.chevron}>{collapsed ? '›' : '⌄'}</Text>
                <Text style={styles.groupLabel}>{group.name}</Text>
              </Pressable>
              <Text style={styles.groupSub}>{formatMoney(subtotal)}</Text>
              <RowMenuButton
                items={[
                  { label: 'Add Category', onPress: () => setPrompt({ type: 'newCategory', groupId: group.id }) },
                  { label: 'Rename Group', onPress: () => setPrompt({ type: 'renameGroup', groupId: group.id, initial: group.name }) },
                  { label: 'Move Up', onPress: () => moveGroup(group.id, 'up') },
                  { label: 'Move Down', onPress: () => moveGroup(group.id, 'down') },
                  { label: 'Delete Group', destructive: true, onPress: () => deleteGroup(group) },
                ]}
              />
            </View>
            {collapsed
              ? null
              : items.length === 0
                ? <Text style={styles.emptyGroup}>No categories yet.</Text>
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
                        <RowMenuButton
                          items={[
                            {
                              label: 'Rename',
                              onPress: () => setPrompt({ type: 'renameCategory', categoryId: item.category.id, initial: item.category.name }),
                            },
                            ...(item.balanceCents > 0
                              ? [{ label: 'Move to Unassigned', onPress: () => moveToUnassigned(item.category.id, item.balanceCents) }]
                              : []),
                            { label: 'Move Up', onPress: () => moveCategory(item.category.id, 'up') },
                            { label: 'Move Down', onPress: () => moveCategory(item.category.id, 'down') },
                            { label: 'Delete', destructive: true, onPress: () => deleteCategory(item.category) },
                          ]}
                        />
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
        <Text style={styles.addGroupButtonText}>+ New Group</Text>
      </Pressable>
      <View style={{ height: 80 }} />

      <PromptModal
        visible={prompt != null}
        title={
          prompt?.type === 'newGroup'
            ? 'New Group'
            : prompt?.type === 'newCategory'
              ? 'New Category'
              : prompt?.type === 'renameGroup'
                ? 'Rename Group'
                : 'Rename Category'
        }
        placeholder={prompt?.type === 'newGroup' || prompt?.type === 'renameGroup' ? 'e.g. Bills' : 'e.g. 🛒 Groceries'}
        initialValue={prompt && 'initial' in prompt ? prompt.initial : ''}
        onCancel={() => setPrompt(null)}
        onSubmit={submitPrompt}
      />

      <AssignedAmountModal
        visible={editingItem != null && !linkModalOpen}
        categoryName={editingItem?.category.name ?? ''}
        categoryIcon={editingItem?.category.icon ?? null}
        initialCents={editingItem?.assignedThisMonthCents ?? 0}
        onSave={saveAssigned}
        onHistory={openHistory}
        onLink={() => setLinkModalOpen(true)}
        onClose={() => setEditingItem(null)}
      />
      <LinkAccountModal
        visible={linkModalOpen}
        eligibleAccounts={eligibleLinkAccounts}
        currentlyLinkedAccountId={editingItem?.category.linkedAccountId ?? null}
        onSelect={linkToAccount}
        onUnlink={unlinkAccount}
        onClose={() => setLinkModalOpen(false)}
      />
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
  groupHeaderMain: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chevron: { color: colors.textMuted, width: 14 },
  groupLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  groupSub: { marginLeft: 'auto', fontSize: 12, fontWeight: '700', color: colors.textMuted },
  emptyGroup: { fontSize: 12, color: colors.textMuted, paddingHorizontal: 2 },
  catRow: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, gap: spacing.xs },
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
