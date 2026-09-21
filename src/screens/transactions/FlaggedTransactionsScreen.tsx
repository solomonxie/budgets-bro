import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { GuideSection } from '../../components/ui/GuideSection';
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';
import {
  DropdownField,
  DropdownGroupLabel,
  DropdownOption,
} from '../../components/ui/DropdownField';
import { SearchableDropdownField } from '../../components/ui/SearchableDropdownField';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import {
  auditBoardTransfers,
  quickFixTransfer,
} from '../../db/repositories/transferIntegrityRepo';
import { useBudget } from '../../hooks/useBudget';
import type { CategoryBudgetItem } from '../../hooks/useBudget';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { useAppStore } from '../../state/useAppStore';
import { formatMoney, formatMoneyExact } from '../../domain/money';
import { currentMonth, formatMonthLabel } from '../../domain/month';
import { overspentMonths } from '../../domain/budgetMath';
import * as budgetsRepo from '../../db/repositories/budgetsRepo';
import {
  REASON_BY_VIOLATION,
  duplicateGroups,
  duplicateTransactionIds,
  missingCategory,
  missingPayee,
  primaryQuickFix,
  quickFixDeletes,
  reviewReasons,
} from '../../domain/transactionReview';
import type { ReviewReason } from '../../domain/transactionReview';
import { useI18n, localeTag } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { TransactionWithLabels } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/types';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

// The worklist is a snapshot taken when the page opens: `reasons` is why a
// row was pulled in, and it doesn't change as you fix things. Fixing a row
// in place would otherwise make it vanish mid-edit — and a row missing both
// a payee and a category needs to stay put long enough to get both.
interface WorkItem {
  txn: TransactionWithLabels;
  reasons: ReviewReason[];
  // Recomputed after an edit; empty means this row is done.
  open: ReviewReason[];
}

const REASON_LABELS: Record<ReviewReason, TranslationKey> = {
  missingPayee: 'review.reasonMissingPayee',
  missingCategory: 'review.reasonMissingCategory',
  duplicate: 'review.reasonDuplicate',
  zeroAmount: 'review.reasonZeroAmount',
  transferMissingLeg: 'review.reasonTransferMissingLeg',
  transferAmountMismatch: 'review.reasonTransferAmountMismatch',
  transferSelfNamed: 'review.reasonTransferSelfNamed',
  transferUnlinked: 'review.reasonTransferUnlinked',
  categoryOverspent: 'review.reasonCategoryOverspent',
};

// Each problem's own remedy, named after what the button will actually do —
// "Fix" on its own says nothing about whether a row is about to be relabelled
// or deleted.
const FIX_LABELS: Partial<Record<ReviewReason, TranslationKey>> = {
  transferMissingLeg: 'review.fixPostLeg',
  transferAmountMismatch: 'review.fixMatchAmounts',
  transferSelfNamed: 'review.fixNameFromOtherSide',
  transferUnlinked: 'review.fixLinkPair',
  duplicate: 'review.fixDelete',
  zeroAmount: 'review.fixDelete',
};

// Shown under the chips once a type is picked. A one-word chip is only
// legible if the page will say what it means somewhere — and these are the
// explanations people actually need: what went wrong, and what the fix does
// to their money.
const REASON_EXPLANATIONS: Record<ReviewReason, TranslationKey> = {
  missingPayee: 'review.explainMissingPayee',
  missingCategory: 'review.explainMissingCategory',
  duplicate: 'review.explainDuplicate',
  zeroAmount: 'review.explainZeroAmount',
  transferMissingLeg: 'review.explainTransferMissingLeg',
  transferAmountMismatch: 'review.explainTransferAmountMismatch',
  transferSelfNamed: 'review.explainTransferSelfNamed',
  transferUnlinked: 'review.explainTransferUnlinked',
  categoryOverspent: 'review.explainCategoryOverspent',
};

const REASON_ORDER: ReviewReason[] = [
  'missingPayee',
  'missingCategory',
  'transferMissingLeg',
  'transferAmountMismatch',
  'transferSelfNamed',
  'transferUnlinked',
  'duplicate',
  'zeroAmount',
  'categoryOverspent',
];

// One list, two kinds of thing to put right: a transaction with a problem,
// and a category that has outspent what it was given.
type OverspentMonth = {
  item: CategoryBudgetItem;
  month: string;
  shortfallCents: number;
};

type ReviewRow =
  { kind: 'txn'; item: WorkItem } | { kind: 'overspent'; item: OverspentMonth };

export function FlaggedTransactionsScreen() {
  const { t, language } = useI18n();
  const navigation = useNavigation<RootNav>();
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const { groups, categories } = useCategories();
  // Overspending is a this-month fact: the fix is assigning money in the
  // month that overspent, so the page works on the month you are in.
  const month = currentMonth();
  const { itemsByGroup, unassignedCents } = useBudget(month);
  const { payees } = usePayees('usage');
  const [items, setItems] = useState<WorkItem[]>([]);
  // Every id that looks like the same event as this one, so "merge" knows
  // what it is merging with.
  const [groupIds, setGroupIds] = useState<Map<number, number[]>>(new Map());
  // Per category, its month-by-month assigned/activity — what tells us which
  // month an overspend actually happened in.
  // Rows whose payee has a right answer nobody has to choose: half of a
  // transfer, named after the account across from it.
  const [nameableIds, setNameableIds] = useState<Set<number>>(new Set());
  const [monthTotals, setMonthTotals] = useState<
    Record<
      number,
      { month: string; assignedCents: number; activityCents: number }[]
    >
  >({});
  const [reasonFilter, setReasonFilter] = useState<ReviewReason | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // A transaction's own problems come from its fields; a transfer's come
  // from whether the row across from it exists and agrees (see
  // domain/transferIntegrity), which only the whole board can answer.
  const load = useCallback(async () => {
    setLoading(true);
    const db = await getDb();
    const [all, violations, totals] = await Promise.all([
      transactionsRepo.listTransactions(db, boardId),
      auditBoardTransfers(db, boardId),
      budgetsRepo.monthlyTotalsByCategory(db, boardId, currentMonth()),
    ]);
    setMonthTotals(totals);
    const dupes = duplicateTransactionIds(all);
    const groups = new Map<number, number[]>();
    for (const group of duplicateGroups(all)) {
      const ids = group.map((txn) => txn.id);
      for (const txn of group) groups.set(txn.id, ids);
    }
    setGroupIds(groups);
    const transferReasons = new Map<number, ReviewReason[]>();
    setNameableIds(
      new Set(
        violations
          .filter((violation) => violation.kind === 'unnamedLeg')
          .map((violation) => violation.row.id),
      ),
    );
    for (const violation of violations) {
      const reason = REASON_BY_VIOLATION[violation.kind];
      const list = transferReasons.get(violation.row.id) ?? [];
      if (!list.includes(reason)) list.push(reason);
      transferReasons.set(violation.row.id, list);
    }
    setItems(
      all
        .map((txn) => {
          const reasons = [
            ...reviewReasons(txn, dupes),
            ...(transferReasons.get(txn.id) ?? []),
          ];
          return { txn, reasons, open: reasons };
        })
        .filter((item) => item.reasons.length > 0),
    );
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    load();
  }, [load]);

  const markResolved = (id: number, resolved: ReviewReason[]) =>
    setItems((prev) =>
      prev.map((item) =>
        item.txn.id === id
          ? { ...item, open: item.open.filter((r) => !resolved.includes(r)) }
          : item,
      ),
    );

  // Reloads the edited row rather than the whole worklist, so the page keeps
  // its place and its scroll position while you work down it.
  const replaceItem = async (id: number) => {
    const db = await getDb();
    const updated = await transactionsRepo.getTransaction(db, id);
    if (updated)
      setItems((prev) =>
        prev.map((item) =>
          item.txn.id === id ? { ...item, txn: updated } : item,
        ),
      );
    bumpDataVersion();
  };

  const applyPayee = async (id: number, payeeName: string) => {
    const name = payeeName.trim();
    if (!name) return;
    const db = await getDb();
    await transactionsRepo.setPayeeForTransactions(db, boardId, [id], name);
    markResolved(id, ['missingPayee']);
    await replaceItem(id);
  };

  const nameFromOtherSide = async (id: number) => {
    const db = await getDb();
    await quickFixTransfer(db, boardId, id, 'transferUnnamed');
    markResolved(id, ['missingPayee']);
    await replaceItem(id);
  };

  const applyCategory = async (id: number, categoryId: number) => {
    const db = await getDb();
    await transactionsRepo.setCategoryForTransactions(db, [id], categoryId);
    markResolved(id, ['missingCategory']);
    await replaceItem(id);
  };

  // One row's remedy, chosen by its own worst problem. Returns whether the
  // row is gone, so a batch can drop it from the list rather than leaving a
  // card for a transaction that no longer exists.
  const runQuickFix = async (item: WorkItem): Promise<boolean> => {
    const reason = primaryQuickFix(item.open);
    if (reason == null) return false;
    const db = await getDb();
    if (quickFixDeletes(reason)) {
      await transactionsRepo.deleteTransactions(db, boardId, [item.txn.id]);
      return true;
    }
    await quickFixTransfer(
      db,
      boardId,
      item.txn.id,
      reason as
        | 'transferUnnamed'
        | 'transferSelfNamed'
        | 'transferUnlinked'
        | 'transferMissingLeg'
        | 'transferAmountMismatch',
    );
    markResolved(item.txn.id, [reason]);
    await replaceItem(item.txn.id);
    return false;
  };

  const fixOne = async (item: WorkItem) => {
    const reason = primaryQuickFix(item.open);
    if (reason == null) return;
    if (quickFixDeletes(reason)) {
      Alert.alert(t('review.deleteConfirmTitle'), t('common.cannotBeUndone'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await runQuickFix(item);
            setItems((prev) => prev.filter((i) => i.txn.id !== item.txn.id));
            bumpDataVersion();
          },
        },
      ]);
      return;
    }
    await runQuickFix(item);
  };

  const selectedItems = items.filter(
    (item) => selectedIds.includes(item.txn.id) && primaryQuickFix(item.open),
  );

  const deletingCount = selectedItems.filter((item) => {
    const reason = primaryQuickFix(item.open);
    return reason != null && quickFixDeletes(reason);
  }).length;

  const applyToSelected = async () => {
    const run = async () => {
      const removed: number[] = [];
      for (const item of selectedItems) {
        if (await runQuickFix(item)) removed.push(item.txn.id);
      }
      if (removed.length > 0)
        setItems((prev) => prev.filter((i) => !removed.includes(i.txn.id)));
      setSelectedIds([]);
      setSelectMode(false);
      bumpDataVersion();
    };
    // Every other quick fix is a relabel; deletions are the one thing in a
    // batch worth stopping for, and the count is what the user needs to hear.
    if (deletingCount === 0) {
      await run();
      return;
    }
    Alert.alert(
      t('review.fixSelectedConfirmTitle', { count: selectedItems.length }),
      t('review.fixSelectedConfirmMessage', { count: deletingCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('review.fixApply'), style: 'destructive', onPress: run },
      ],
    );
  };

  // Only offered where it can't quietly break something else: a transfer
  // leg's partner would keep the old amount (see mergeTransactions).
  const mergeableGroup = (id: number): number[] | null => {
    const ids = groupIds.get(id);
    if (!ids || ids.length < 2) return null;
    const rows = items.filter((item) => ids.includes(item.txn.id));
    if (rows.some((item) => item.txn.transferAccountId != null)) return null;
    return ids;
  };

  const mergeGroup = (ids: number[]) => {
    Alert.alert(
      t('review.mergeConfirmTitle', { count: ids.length }),
      t('review.mergeConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('review.fixMerge'),
          onPress: async () => {
            const db = await getDb();
            await transactionsRepo.mergeTransactions(db, boardId, ids);
            bumpDataVersion();
            await load();
          },
        },
      ],
    );
  };

  const applyPayeeToSelected = async (payeeName: string) => {
    const name = payeeName.trim();
    if (!name) return;
    const db = await getDb();
    await transactionsRepo.setPayeeForTransactions(
      db,
      boardId,
      selectedIds,
      name,
    );
    setSelectedIds([]);
    setSelectMode(false);
    bumpDataVersion();
    await load();
  };

  // Only the rows that have an other side to take a name from — the rest of
  // a mixed selection keep whatever the picker sets.
  const nameSelectedFromOtherSide = async () => {
    const db = await getDb();
    for (const id of selectedIds) {
      if (!nameableIds.has(id)) continue;
      await quickFixTransfer(db, boardId, id, 'transferUnnamed');
    }
    setSelectedIds([]);
    setSelectMode(false);
    bumpDataVersion();
    await load();
  };

  const applyCategoryToSelected = async (categoryId: number) => {
    const db = await getDb();
    await transactionsRepo.setCategoryForTransactions(
      db,
      selectedIds,
      categoryId,
    );
    setSelectedIds([]);
    setSelectMode(false);
    bumpDataVersion();
    await load();
  };

  const deleteSelected = () => {
    Alert.alert(
      t('transactions.deleteSelectedConfirmTitle', {
        count: selectedIds.length,
      }),
      t('common.cannotBeUndone'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const db = await getDb();
            await transactionsRepo.deleteTransactions(db, boardId, selectedIds);
            setSelectedIds([]);
            setSelectMode(false);
            bumpDataVersion();
            await load();
          },
        },
      ],
    );
  };

  // Each selected row merges with its own duplicates, not with every other
  // selected row — two separate double-entries stay two transactions.
  const mergeSelected = async () => {
    const done = new Set<number>();
    const db = await getDb();
    for (const id of selectedIds) {
      if (done.has(id)) continue;
      const ids = mergeableGroup(id);
      if (!ids) continue;
      await transactionsRepo.mergeTransactions(db, boardId, ids);
      for (const member of ids) done.add(member);
    }
    setSelectedIds([]);
    setSelectMode(false);
    bumpDataVersion();
    await load();
  };

  const confirmDelete = (txn: TransactionWithLabels) => {
    Alert.alert(t('review.deleteConfirmTitle'), t('common.cannotBeUndone'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await transactionsRepo.deleteTransactions(db, boardId, [txn.id]);
          setItems((prev) => prev.filter((item) => item.txn.id !== txn.id));
          bumpDataVersion();
        },
      },
    ]);
  };

  // One card per category *per month* that overspent — a hole dug in June
  // is June's problem, not also July's and August's (see overspentMonths).
  const overspent: OverspentMonth[] = Object.values(itemsByGroup)
    .flat()
    .flatMap((item) =>
      overspentMonths(monthTotals[item.category.id] ?? []).map((entry) => ({
        item,
        month: entry.month,
        shortfallCents: entry.shortfallCents,
      })),
    )
    .sort((a, b) => a.month.localeCompare(b.month));

  // Assigns into the month that broke, on top of whatever that month
  // already had. A balance is a running sum, so this lifts every month
  // after it too — which is the whole reason it has to go there rather than
  // into today's month, where it would leave the broken month still reading
  // as overspent however much you put in.
  //
  // The money comes out of Unassigned Cash, which is what "funding" means
  // here — so it is only offered when there is enough sitting there; the
  // alternative is silently pushing Unassigned negative, which is a
  // different decision and not one a Fix button should make.
  const fundOverspend = async (row: OverspentMonth) => {
    const db = await getDb();
    const assignedThen =
      (monthTotals[row.item.category.id] ?? []).find(
        (m) => m.month === row.month,
      )?.assignedCents ?? 0;
    await budgetsRepo.setAssignedCents(
      db,
      boardId,
      row.item.category.id,
      row.month,
      assignedThen + row.shortfallCents,
    );
    bumpDataVersion();
    await load();
  };

  const counts = REASON_ORDER.map((reason) => ({
    reason,
    count:
      reason === 'categoryOverspent'
        ? overspent.length
        : items.filter((item) => item.reasons.includes(reason)).length,
  })).filter((entry) => entry.count > 0);

  const visibleTxns =
    reasonFilter == null
      ? items
      : reasonFilter === 'categoryOverspent'
        ? []
        : items.filter((item) => item.reasons.includes(reasonFilter));
  const visibleCategories =
    reasonFilter == null || reasonFilter === 'categoryOverspent'
      ? overspent
      : [];
  const visible = visibleTxns;
  const rows: ReviewRow[] = [
    ...visibleCategories.map((item) => ({ kind: 'overspent' as const, item })),
    ...visibleTxns.map((item) => ({ kind: 'txn' as const, item })),
  ];

  const toggle = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const renderOverspent = (row: OverspentMonth) => {
    const affordable = unassignedCents >= row.shortfallCents;
    const monthLabel = formatMonthLabel(row.month, localeTag(language));
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.payee}>
              {`${row.item.category.icon ? row.item.category.icon + ' ' : ''}${row.item.category.name}`}
            </Text>
            <Text style={styles.sub}>{monthLabel}</Text>
          </View>
          <Text style={[styles.amount, styles.negative]}>
            {formatMoney(-row.shortfallCents)}
          </Text>
        </View>
        <View style={styles.badges}>
          <Text style={styles.badge}>
            {t('review.reasonCategoryOverspent')}
          </Text>
          {affordable ? (
            <Pressable
              style={styles.fixButton}
              onPress={() => fundOverspend(row)}
            >
              <Text style={styles.fixButtonText}>
                {t('review.fundCategory', {
                  amount: formatMoney(row.shortfallCents),
                  month: monthLabel,
                })}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.shortfallHint}>
              {t('review.fundShortfall', {
                amount: formatMoney(
                  row.shortfallCents - Math.max(0, unassignedCents),
                ),
              })}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderRow = ({ item: row }: { item: ReviewRow }) =>
    row.kind === 'overspent' ? renderOverspent(row.item) : renderItem(row.item);

  const renderItem = (item: WorkItem) => {
    const { txn, open } = item;
    const needsPayee = missingPayee(txn);
    const nameable = needsPayee && nameableIds.has(txn.id);
    const needsCategory = missingCategory(txn);
    const fixReason = primaryQuickFix(open);
    const fixLabel = fixReason ? FIX_LABELS[fixReason] : undefined;
    const mergeIds = open.includes('duplicate') ? mergeableGroup(txn.id) : null;
    return (
      // The card itself opens the transaction — the pickers and the menu
      // inside it take their own taps, so only the blank of the card and its
      // summary line fall through to here.
      <Pressable
        style={[styles.card, open.length === 0 && styles.cardFixed]}
        onPress={() =>
          selectMode
            ? toggle(txn.id)
            : navigation.navigate('AddTransaction', { transactionId: txn.id })
        }
      >
        <View style={styles.cardTop}>
          {selectMode ? (
            <View
              style={[
                styles.checkbox,
                selectedIds.includes(txn.id) && styles.checkboxChecked,
              ]}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.payee}>
              {txn.payeeName ?? t('common.noPayee')}
            </Text>
            <Text style={styles.sub}>
              {[txn.date, txn.accountName].join(' · ')}
            </Text>
            {txn.memo ? (
              <Text style={styles.memo} numberOfLines={1}>
                {txn.memo}
              </Text>
            ) : null}
          </View>
          <Text
            style={[
              styles.amount,
              txn.amountCents < 0 ? styles.negative : styles.positive,
            ]}
          >
            {formatMoneyExact(txn.amountCents)}
          </Text>
          <RowMenuButton
            items={[
              {
                label: t('common.delete'),
                destructive: true,
                onPress: () => confirmDelete(txn),
              },
            ]}
          />
        </View>
        <View style={styles.badges}>
          {open.length === 0 ? (
            <Text style={[styles.badge, styles.badgeFixed]}>
              {t('review.fixed')}
            </Text>
          ) : (
            open.map((reason) => (
              <Text key={reason} style={styles.badge}>
                {t(REASON_LABELS[reason])}
              </Text>
            ))
          )}
          {fixLabel && !selectMode ? (
            <Pressable style={styles.fixButton} onPress={() => fixOne(item)}>
              <Text style={styles.fixButtonText}>{t(fixLabel)}</Text>
            </Pressable>
          ) : null}
          {/* A duplicate has two right answers, so it gets both: the rows
              were one event recorded twice (delete), or two halves of one
              purchase that should be a single line (merge to the total). */}
          {mergeIds && !selectMode ? (
            <Pressable
              style={styles.mergeButton}
              onPress={() => mergeGroup(mergeIds)}
            >
              <Text style={styles.mergeButtonText}>
                {t('review.fixMergeCount', { count: mergeIds.length })}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {nameable && !selectMode ? (
          <Pressable
            style={styles.fixButton}
            onPress={() => nameFromOtherSide(txn.id)}
          >
            <Text style={styles.fixButtonText}>
              {t('review.fixNameFromOtherSide')}
            </Text>
          </Pressable>
        ) : null}
        {needsPayee && !nameable && !selectMode ? (
          <SearchableDropdownField
            compact
            hideLabel
            label={t('common.payee')}
            valueLabel=""
            placeholder={t('review.pickPayee')}
            searchPlaceholder={t('spend.payeeSearchPlaceholder')}
            options={payees.map((p) => ({
              id: p.id,
              label: p.name,
              badge:
                p.linkedAccountId != null
                  ? t('payeePicker.accountBadge')
                  : undefined,
            }))}
            onSelect={(o) => applyPayee(txn.id, o.label)}
            onUseText={(text) => applyPayee(txn.id, text)}
          />
        ) : null}
        {needsCategory && !selectMode ? (
          <DropdownField
            compact
            hideLabel
            label={t('common.category')}
            valueLabel=""
            placeholder={t('review.pickCategory')}
          >
            {(close) => (
              <>
                {groups.map((group) => {
                  const groupCategories = categories.filter(
                    (c) => c.groupId === group.id,
                  );
                  if (groupCategories.length === 0) return null;
                  return (
                    <View key={group.id}>
                      <DropdownGroupLabel label={group.name} />
                      {groupCategories.map((c) => (
                        <DropdownOption
                          key={c.id}
                          label={`${c.icon ? c.icon + ' ' : ''}${c.name}`}
                          selected={false}
                          onPress={() => {
                            applyCategory(txn.id, c.id);
                            close();
                          }}
                        />
                      ))}
                    </View>
                  );
                })}
              </>
            )}
          </DropdownField>
        ) : null}
      </Pressable>
    );
  };

  // What a batch can act on, which depends on which problem is on screen:
  // under "no payee" every row takes the same payee, under "no category"
  // the same category, and elsewhere each row takes its own quick fix.
  // Under no filter at all there is no single action to apply, so select
  // mode isn't offered — "fix everything" is not one decision.
  const batchable =
    reasonFilter == null
      ? []
      : visible.filter((item) => {
          if (reasonFilter === 'missingPayee') return missingPayee(item.txn);
          if (reasonFilter === 'missingCategory')
            return missingCategory(item.txn);
          return primaryQuickFix(item.open) != null;
        });
  const batchIds = batchable.map((item) => item.txn.id);

  return (
    <ScreenContainer>
      <ExpandingFieldGroup>
        <View style={styles.toolbar}>
          <Text style={styles.count}>
            {t('review.chipAll', { count: items.length })}
          </Text>
          {batchable.length > 0 ? (
            <Pressable
              onPress={() => {
                setSelectMode((v) => !v);
                setSelectedIds([]);
              }}
              hitSlop={8}
            >
              <Text style={styles.selectLink}>
                {selectMode ? t('common.done') : t('transactions.select')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {counts.length > 0 ? (
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, reasonFilter == null && styles.chipActive]}
              onPress={() => {
                setReasonFilter(null);
                setSelectMode(false);
                setSelectedIds([]);
              }}
            >
              <Text style={styles.chipText}>{t('transactions.allRows')}</Text>
            </Pressable>
            {counts.map(({ reason, count }) => (
              <Pressable
                key={reason}
                style={[
                  styles.chip,
                  reasonFilter === reason && styles.chipActive,
                ]}
                onPress={() => {
                  setReasonFilter(reason);
                  setSelectMode(false);
                  setSelectedIds([]);
                }}
              >
                <Text style={styles.chipText}>
                  {`${t(REASON_LABELS[reason])} ${count}`}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {reasonFilter != null ? (
          <Text style={styles.explanation}>
            {t(REASON_EXPLANATIONS[reasonFilter])}
          </Text>
        ) : null}
        <FlatList
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          data={rows}
          keyExtractor={(row) =>
            row.kind === 'overspent'
              ? `overspent-${row.item.item.category.id}-${row.item.month}`
              : `txn-${row.item.txn.id}`
          }
          renderItem={renderRow}
          // The explanation scrolls with the list rather than pinning, and
          // sits under it: the rows are the page, and anything above them
          // pushed them down every time you came back to it.
          ListFooterComponent={
            <GuideSection
              heading={t('review.guideBottomHeading')}
              body={t('review.guideBottomBody')}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={colors.textMuted}
            />
          }
          ListEmptyComponent={
            loading ? null : (
              <Text style={styles.empty}>{t('review.allClear')}</Text>
            )
          }
        />
      </ExpandingFieldGroup>
      {/* Outside the expanding group on purpose: a picker unfolds *below* its
          row, and this row is already at the bottom of the screen — these
          two open as sheets instead. */}
      {selectMode ? (
        <View style={styles.selectionBar}>
          <Pressable
            onPress={() =>
              setSelectedIds((prev) =>
                prev.length >= batchIds.length ? [] : batchIds,
              )
            }
            hitSlop={8}
          >
            <Text style={styles.selectLink}>
              {selectedIds.length >= batchIds.length && batchIds.length > 0
                ? t('transactions.selectNone')
                : t('transactions.selectAll')}
            </Text>
          </Pressable>
          <Text style={styles.count}>
            {t('transactions.selectedCount', { count: selectedIds.length })}
          </Text>
          {reasonFilter === 'missingPayee' ? (
            <>
              {selectedIds.some((id) => nameableIds.has(id)) ? (
                <Pressable
                  style={styles.mergeButton}
                  onPress={nameSelectedFromOtherSide}
                >
                  <Text style={styles.mergeButtonText}>
                    {t('review.fixNameFromOtherSide')}
                  </Text>
                </Pressable>
              ) : null}
              <View style={styles.barField}>
                <SearchableDropdownField
                  compact
                  hideLabel
                  label={t('common.payee')}
                  valueLabel=""
                  placeholder={t('review.setPayeeForSelected')}
                  searchPlaceholder={t('spend.payeeSearchPlaceholder')}
                  options={payees.map((p) => ({
                    id: p.id,
                    label: p.name,
                    badge:
                      p.linkedAccountId != null
                        ? t('payeePicker.accountBadge')
                        : undefined,
                  }))}
                  onSelect={(o) => applyPayeeToSelected(o.label)}
                  onUseText={applyPayeeToSelected}
                />
              </View>
            </>
          ) : reasonFilter === 'missingCategory' ? (
            <View style={styles.barField}>
              <DropdownField
                compact
                hideLabel
                label={t('common.category')}
                valueLabel=""
                placeholder={t('review.setCategoryForSelected')}
              >
                {(close) => (
                  <>
                    {groups.map((group) => {
                      const groupCategories = categories.filter(
                        (c) => c.groupId === group.id,
                      );
                      if (groupCategories.length === 0) return null;
                      return (
                        <View key={group.id}>
                          <DropdownGroupLabel label={group.name} />
                          {groupCategories.map((c) => (
                            <DropdownOption
                              key={c.id}
                              label={`${c.icon ? c.icon + ' ' : ''}${c.name}`}
                              selected={false}
                              onPress={() => {
                                applyCategoryToSelected(c.id);
                                close();
                              }}
                            />
                          ))}
                        </View>
                      );
                    })}
                  </>
                )}
              </DropdownField>
            </View>
          ) : reasonFilter === 'duplicate' ? (
            <>
              <Pressable
                style={[
                  styles.mergeButton,
                  selectedIds.length === 0 && styles.fixButtonDisabled,
                ]}
                disabled={selectedIds.length === 0}
                onPress={mergeSelected}
              >
                <Text style={styles.mergeButtonText}>
                  {t('review.fixMerge')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.deleteButton,
                  selectedIds.length === 0 && styles.fixButtonDisabled,
                ]}
                disabled={selectedIds.length === 0}
                onPress={deleteSelected}
              >
                <Text style={styles.fixButtonText}>{t('common.delete')}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[
                styles.fixButton,
                selectedItems.length === 0 && styles.fixButtonDisabled,
              ]}
              disabled={selectedItems.length === 0}
              onPress={applyToSelected}
            >
              <Text style={styles.fixButtonText}>
                {t('review.fixSelected', { count: selectedItems.length })}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  count: { flex: 1, fontSize: 13, color: colors.textMuted },
  selectLink: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: colors.surface, borderColor: colors.accent },
  chipText: { fontSize: 12, color: colors.text },
  explanation: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  // Still on the page — the row you just finished stays where it was, so
  // the list doesn't reshuffle under your thumb.
  cardFixed: { opacity: 0.55 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  payee: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  memo: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  amount: { fontSize: 15, fontWeight: '700' },
  negative: { color: colors.negative },
  positive: { color: colors.positive },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  badgeFixed: { color: colors.positive, borderColor: colors.positive },
  fixButton: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  fixButtonDisabled: { opacity: 0.4 },
  shortfallHint: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  mergeButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  mergeButtonText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  deleteButton: {
    backgroundColor: colors.negative,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  barField: { minWidth: 150 },
  fixButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
});
