import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { GuideSection } from '../../components/ui/GuideSection';
import { SearchableDropdownField } from '../../components/ui/SearchableDropdownField';
import { PaymentResolutionModal } from './PaymentResolutionModal';
import { usePaymentReview } from '../../hooks/usePaymentReview';
import { usePayees } from '../../hooks/usePayees';
import { getDb } from '../../db/client';
import * as paymentReviewRepo from '../../db/repositories/paymentReviewRepo';
import { addMonths } from '../../finance-tools/amortization';
import type { ReviewCadence, ReviewItem } from '../../domain/paymentReview';
import { formatDateLabel } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useI18n, localeTag } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { useAppStore } from '../../state/useAppStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const SECTIONS: { cadence: ReviewCadence; titleKey: TranslationKey }[] = [
  { cadence: 'monthly', titleKey: 'abr.monthlySection' },
  { cadence: 'annual', titleKey: 'abr.annualSection' },
  { cadence: 'adHoc', titleKey: 'abr.adHocSection' },
];

// Annual payment review: every recurring outflow, once a year, gets a
// decision — keep it, change how it's billed, or stop paying for it.
export function PaymentReviewScreen() {
  const { t, language } = useI18n();
  const locale = localeTag(language);
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const { items, loading, today } = usePaymentReview();
  const { payees } = usePayees('usage');
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  const reviewed = useMemo(() => items.filter((i) => !i.ignored), [items]);
  const ignored = useMemo(() => items.filter((i) => i.ignored), [items]);
  const due = reviewed.filter((i) => i.due);
  const yearlyTotal = useMemo(() => reviewed.reduce((s, i) => s + i.yearlyCents, 0), [reviewed]);
  const trackedPayeeIds = useMemo(() => new Set(items.map((i) => i.payeeId)), [items]);
  const payeeOptions = payees
    .filter((p) => p.linkedAccountId == null && !trackedPayeeIds.has(p.id))
    .map((p) => ({ id: p.id, label: p.name }));

  const track = async (name: string) => {
    const db = await getDb();
    await paymentReviewRepo.trackPayee(db, boardId, name, addMonths(today, 12));
    bumpDataVersion();
  };

  const amountLabel = (item: ReviewItem) => {
    if (item.cadence === 'adHoc') return t('abr.perYear', { amount: formatMoney(item.yearlyCents) });
    return t(item.cadence === 'annual' ? 'abr.perYear' : 'abr.perMonth', {
      amount: formatMoney(item.cadence === 'annual' ? item.yearlyCents : Math.round(item.yearlyCents / 12)),
    });
  };

  const detailLabel = (item: ReviewItem) => {
    if (item.note) return t('abr.lookingFor', { note: item.note });
    if (item.detected && item.lastDate)
      return t(item.cadence === 'annual' ? 'abr.detectedAnnual' : 'abr.detectedMonthly', {
        date: formatDateLabel(item.cadence === 'annual' && item.nextDate ? item.nextDate : item.lastDate, locale),
      });
    if (item.cadence === 'annual' && item.nextDate) return t('abr.renews', { date: formatDateLabel(item.nextDate, locale) });
    if (item.cadence === 'adHoc')
      return item.lastDate ? t('abr.lastPaid', { date: formatDateLabel(item.lastDate, locale) }) : t('abr.neverPaid');
    return t('abr.reviewBy', { date: formatDateLabel(item.reviewOn, locale) });
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

  if (loading) return <ScreenContainer />;

  return (
    <ScreenContainer scroll>
      <GuideSection heading={t('abr.guideHeading')} body={t('abr.guideBody')} />

      <View style={styles.card}>
        <Text style={styles.label}>{t('abr.yearlyTotal')}</Text>
        <Text style={styles.value}>{formatMoney(yearlyTotal)}</Text>
        <Text style={styles.hint}>{t('abr.commitmentCount', { count: reviewed.length })}</Text>
      </View>

      {due.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, styles.dueTitle]}>{t('abr.dueSection', { count: due.length })}</Text>
          <View style={[styles.card, styles.dueCard]}>{due.map(renderRow)}</View>
        </>
      ) : null}

      {SECTIONS.map(({ cadence, titleKey }) => {
        const rows = reviewed.filter((i) => i.cadence === cadence && !i.due);
        if (rows.length === 0 && cadence !== 'adHoc') return null;
        return (
          <View key={cadence}>
            <Text style={styles.sectionTitle}>{t(titleKey)}</Text>
            {rows.length > 0 ? <View style={styles.card}>{rows.map(renderRow)}</View> : null}
          </View>
        );
      })}
      <Text style={styles.hint}>{t('abr.adHocHint')}</Text>
      <SearchableDropdownField
        label={t('abr.addAdHoc')}
        valueLabel=""
        searchPlaceholder={t('abr.addAdHocSearch')}
        options={payeeOptions}
        onSelect={(o) => track(o.label)}
        onUseText={track}
        compact
        autoFocusSearch={false}
        renderField={(open) => (
          <Pressable style={styles.addButton} onPress={open}>
            <Text style={styles.addButtonText}>{t('abr.addAdHoc')}</Text>
          </Pressable>
        )}
      />

      {items.length === 0 ? <Text style={styles.hint}>{t('abr.empty')}</Text> : null}

      {ignored.length > 0 ? (
        <Pressable style={styles.ignoredLink} onPress={() => setShowIgnored(!showIgnored)} hitSlop={8}>
          <Text style={styles.ignoredLinkText}>
            {t(showIgnored ? 'abr.hideIgnored' : 'abr.showIgnored', { count: ignored.length })}
          </Text>
        </Pressable>
      ) : null}
      {showIgnored && ignored.length > 0 ? <View style={[styles.card, styles.ignoredCard]}>{ignored.map(renderRow)}</View> : null}

      <PaymentResolutionModal item={selected} today={today} onClose={() => setSelected(null)} />
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
  addButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: { color: colors.accent, fontWeight: '700' },
  ignoredLink: { alignSelf: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm },
  ignoredLinkText: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
  ignoredCard: { opacity: 0.7 },
});
