import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { GuideSection } from '../../components/ui/GuideSection';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { DropdownOption } from '../../components/ui/DropdownField';
import { DECISION_LABEL, PaymentDecisionModal } from './PaymentDecisionModal';
import { CardModal } from '../../components/ui/CardModal';
import { usePaymentReview } from '../../hooks/usePaymentReview';
import { useCategories } from '../../hooks/useCategories';
import { getDb } from '../../db/client';
import * as paymentReviewRepo from '../../db/repositories/paymentReviewRepo';
import { decisionItemKey } from '../../domain/paymentReview';
import type { PaymentDecision, ReviewCadence, ReviewFilter, ReviewItem } from '../../domain/paymentReview';
import { formatDateLabel } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useI18n, localeTag } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { useAppStore } from '../../state/useAppStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const SECTIONS: { cadence: ReviewCadence; titleKey: TranslationKey }[] = [
  { cadence: 'monthly', titleKey: 'qbr.monthlySection' },
  { cadence: 'annual', titleKey: 'qbr.annualSection' },
];

type FilterKind = 'payeeIds' | 'categoryIds';

interface FilterOption {
  id: number;
  label: string;
}

// Quarterly payment review: every recurring outflow, each quarter, gets a
// decision. The page never changes a transaction or schedule — a decision
// that needs doing lands in To Do until the user marks it done, then History.
export function PaymentReviewScreen() {
  const { t, language } = useI18n();
  const locale = localeTag(language);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const { allItems, items, filter, setFilter, todo, history, loading, today } = usePaymentReview();
  const { categories } = useCategories();
  const [filterOpen, setFilterOpen] = useState<FilterKind | null>(null);
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);
  const [openTodo, setOpenTodo] = useState<PaymentDecision | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const todoByKey = useMemo(() => new Map(todo.map((d) => [decisionItemKey(d), d])), [todo]);

  const reviewed = useMemo(() => items.filter((i) => !i.ignored), [items]);
  const ignored = useMemo(() => items.filter((i) => i.ignored), [items]);
  const due = reviewed.filter((i) => i.due);
  const yearlyTotal = useMemo(() => reviewed.reduce((s, i) => s + i.yearlyCents, 0), [reviewed]);

  // Only payees and categories that have something to review are offered.
  const filterOptions = useMemo(() => {
    const payees = new Map<number, string>();
    const categoryIds = new Set<number>();
    for (const i of allItems) {
      if (i.payeeId != null) payees.set(i.payeeId, i.schedule?.payeeName ?? i.name);
      if (i.categoryId != null) categoryIds.add(i.categoryId);
    }
    const byLabel = (a: FilterOption, b: FilterOption) => a.label.localeCompare(b.label);
    return {
      payeeIds: [...payees].map(([id, label]) => ({ id, label })).sort(byLabel),
      categoryIds: categories
        .filter((c) => categoryIds.has(c.id))
        .map((c) => ({ id: c.id, label: `${c.icon ? c.icon + ' ' : ''}${c.name}` }))
        .sort(byLabel),
    } satisfies Record<FilterKind, FilterOption[]>;
  }, [allItems, categories]);

  const filterLabel = (kind: FilterKind) => {
    const total = filterOptions[kind].length;
    const excluded = filterOptions[kind].filter((o) => filter[kind].includes(o.id)).length;
    const [all, some] = kind === 'payeeIds' ? (['qbr.allPayees', 'qbr.somePayees'] as const) : (['qbr.allCategories', 'qbr.someCategories'] as const);
    return excluded === 0 ? t(all) : t(some, { count: total - excluded, total });
  };

  const toggleFilter = (kind: FilterKind, id: number) => {
    const ids = filter[kind];
    const next: ReviewFilter = { ...filter, [kind]: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] };
    setFilter(next);
  };

  const selectAll = (kind: FilterKind) => setFilter({ ...filter, [kind]: [] });

  const amountLabel = (item: ReviewItem) => {
    return t(item.cadence === 'annual' ? 'qbr.perYear' : 'qbr.perMonth', {
      amount: formatMoney(item.cadence === 'annual' ? item.yearlyCents : Math.round(item.yearlyCents / 12)),
    });
  };

  const detailLabel = (item: ReviewItem) => {
    const pending = todoByKey.get(item.key);
    if (pending) return t('qbr.todoFor', { decision: t(DECISION_LABEL[pending.decision]) });
    if (item.detected && item.lastDate)
      return t(item.cadence === 'annual' ? 'qbr.detectedAnnual' : 'qbr.detectedMonthly', {
        date: formatDateLabel(item.cadence === 'annual' && item.nextDate ? item.nextDate : item.lastDate, locale),
      });
    if (item.cadence === 'annual' && item.nextDate) return t('qbr.renews', { date: formatDateLabel(item.nextDate, locale) });
    return t('qbr.reviewBy', { date: formatDateLabel(item.reviewOn, locale) });
  };

  const renderRow = (item: ReviewItem, i: number) => (
    <Pressable
      key={item.key}
      style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
      onPress={() => setSelected(item)}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.rowDetail, item.due && styles.rowDue]} numberOfLines={1}>
          {detailLabel(item)}
        </Text>
      </View>
      <Text style={styles.rowAmount}>{amountLabel(item)}</Text>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );

  const renderDecision = (d: PaymentDecision, i: number) => {
    const open = d.doneOn == null;
    const overdue = open && d.dueOn != null && d.dueOn <= today;
    const when = open
      ? d.dueOn
        ? t('qbr.dueBy', { date: formatDateLabel(d.dueOn, locale) })
        : ''
      : t(d.doneOn === d.decidedOn ? 'qbr.decidedOn' : 'qbr.doneOn', { date: formatDateLabel(d.doneOn!, locale) });
    return (
      <Pressable
        key={d.id}
        disabled={!open}
        style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
        onPress={() => setOpenTodo(d)}
      >
        <View style={styles.rowMain}>
          <Text style={styles.rowName} numberOfLines={1}>
            {t(DECISION_LABEL[d.decision])} · {d.name}
          </Text>
          <Text style={[styles.rowDetail, overdue && styles.rowDue]} numberOfLines={2}>
            {[when, d.note].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {open ? <Text style={styles.arrow}>›</Text> : null}
      </Pressable>
    );
  };

  const closeTodo = async (action: 'done' | 'delete') => {
    if (!openTodo) return;
    const db = await getDb();
    if (action === 'done') await paymentReviewRepo.markDecisionDone(db, openTodo.id, today);
    else await paymentReviewRepo.deleteDecision(db, openTodo.id);
    setOpenTodo(null);
    bumpDataVersion();
  };

  const HISTORY_PREVIEW = 5;
  const shownHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW);

  if (loading) return <ScreenContainer />;

  return (
    <ScreenContainer scroll>
      <GuideSection heading={t('qbr.guideHeading')} body={t('qbr.guideBody')} />

      {allItems.length > 0 ? (
        <View style={styles.filterRow}>
          {(['payeeIds', 'categoryIds'] as const).map((kind) => (
            <Pressable key={kind} onPress={() => setFilterOpen(kind)} hitSlop={8}>
              <Text style={[styles.filterText, filter[kind].length > 0 && styles.filterActive]}>{filterLabel(kind)} ▾</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>{t('qbr.yearlyTotal')}</Text>
        <Text style={styles.value}>{formatMoney(yearlyTotal)}</Text>
        <Text style={styles.hint}>{t('qbr.commitmentCount', { count: reviewed.length })}</Text>
      </View>

      {todo.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t('qbr.todoSection', { count: todo.length })}</Text>
          <View style={styles.card}>{todo.map(renderDecision)}</View>
        </>
      ) : null}

      {due.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, styles.dueTitle]}>{t('qbr.dueSection', { count: due.length })}</Text>
          <View style={[styles.card, styles.dueCard]}>{due.map(renderRow)}</View>
        </>
      ) : null}

      {SECTIONS.map(({ cadence, titleKey }) => {
        const rows = reviewed.filter((i) => i.cadence === cadence && !i.due && !i.decided);
        if (rows.length === 0) return null;
        return (
          <View key={cadence}>
            <Text style={styles.sectionTitle}>{t(titleKey)}</Text>
            <View style={styles.card}>{rows.map(renderRow)}</View>
          </View>
        );
      })}

      {allItems.length === 0 ? <Text style={styles.hint}>{t('qbr.empty')}</Text> : null}

      {ignored.length > 0 ? (
        <Pressable style={styles.ignoredLink} onPress={() => setShowIgnored(!showIgnored)} hitSlop={8}>
          <Text style={styles.ignoredLinkText}>
            {t(showIgnored ? 'qbr.hideIgnored' : 'qbr.showIgnored', { count: ignored.length })}
          </Text>
        </Pressable>
      ) : null}
      {showIgnored && ignored.length > 0 ? <View style={[styles.card, styles.ignoredCard]}>{ignored.map(renderRow)}</View> : null}

      {history.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t('qbr.historySection')}</Text>
          <View style={styles.card}>{shownHistory.map(renderDecision)}</View>
          {history.length > HISTORY_PREVIEW ? (
            <Pressable style={styles.ignoredLink} onPress={() => setShowAllHistory(!showAllHistory)} hitSlop={8}>
              <Text style={styles.ignoredLinkText}>
                {showAllHistory ? t('qbr.showLessHistory') : t('qbr.showAllHistory', { count: history.length })}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      <PaymentDecisionModal item={selected} today={today} onClose={() => setSelected(null)} />
      <Modal visible={filterOpen != null} transparent animationType="slide" onRequestClose={() => setFilterOpen(null)}>
        {filterOpen ? (
          <BottomSheet
            title={t(filterOpen === 'payeeIds' ? 'qbr.filterPayeesTitle' : 'qbr.filterCategoriesTitle')}
            onClose={() => setFilterOpen(null)}
          >
            <DropdownOption label={t('qbr.selectAll')} selected={filter[filterOpen].length === 0} onPress={() => selectAll(filterOpen)} />
            {filterOptions[filterOpen].map((o) => (
              <DropdownOption
                key={o.id}
                label={o.label}
                selected={!filter[filterOpen].includes(o.id)}
                onPress={() => toggleFilter(filterOpen, o.id)}
              />
            ))}
          </BottomSheet>
        ) : null}
      </Modal>
      <CardModal visible={openTodo != null} onCancel={() => setOpenTodo(null)}>
        {openTodo ? (
          <>
            <Text style={styles.modalTitle}>
              {t(DECISION_LABEL[openTodo.decision])} · {openTodo.name}
            </Text>
            {openTodo.note ? <Text style={styles.modalNote}>{openTodo.note}</Text> : null}
            <Text style={styles.modalHint}>{t('qbr.markDoneHint')}</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => closeTodo('delete')}>
                <Text style={styles.deleteText}>{t('qbr.deleteTodo')}</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={() => closeTodo('done')}>
                <Text style={styles.saveButtonText}>{t('qbr.markDone')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </CardModal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  dueCard: { borderColor: colors.amber },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  value: { fontSize: 30, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginVertical: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  dueTitle: { color: colors.amber },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowPressed: { opacity: 0.6 },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowDetail: { fontSize: 12, color: colors.textMuted },
  rowDue: { color: colors.amber },
  rowAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
  arrow: { fontSize: 18, color: colors.textMuted },
  filterRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.md },
  filterText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  filterActive: { color: colors.accent },
  ignoredLink: { alignSelf: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm },
  ignoredLinkText: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
  ignoredCard: { opacity: 0.7 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  modalNote: { fontSize: 14, color: colors.text, lineHeight: 19 },
  modalHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  deleteText: { color: colors.negative, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
