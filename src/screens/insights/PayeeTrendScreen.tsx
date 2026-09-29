import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { GuideSection } from '../../components/ui/GuideSection';
import { MonthlyBarChart } from '../../components/ui/MonthlyBarChart';
import { usePayeeTrend } from '../../hooks/usePayeeTrend';
import type { PayeeFlow } from '../../hooks/usePayeeTrend';
import { payeeMonthOverAverage } from '../../domain/payeeTrend';
import type { PayeeSummary } from '../../domain/payeeTrend';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Who the money actually goes to. The category breakdown says what kind of
// spending it was; this says whose hand it ended up in, which is the half
// you can do something about — you can't stop buying groceries, but you can
// stop buying them there.
//
// Top payee gets the chart open, because that one answer is what the page
// is for. The rest open in place, the same as Tracked Prices: the
// ranking is the frame of reference, and pushing a detail page would cost
// you your place in it.
export function PayeeTrendScreen() {
  return <PayeeRanking flow="spending" />;
}

// The same page for money coming in: who pays you, ranked, with each
// source's months. An inflow's source is its payee.
export function IncomeTrendScreen() {
  return <PayeeRanking flow="income" />;
}

const COPY_PREFIX = { spending: 'payeeTrend', income: 'incomeTrend' } as const;
type Prefix = (typeof COPY_PREFIX)[PayeeFlow];
type CopyKey<P extends Prefix> = {
  [K in TranslationKey]: K extends `${P}.${infer S}` ? S : never;
}[TranslationKey];
// Only what both pages define, so a missing income string fails tsc.
type SharedCopyKey = CopyKey<'payeeTrend'> & CopyKey<'incomeTrend'>;

function PayeeRanking({ flow }: { flow: PayeeFlow }) {
  const translate = useT();
  const t = (
    key: `payeeTrend.${SharedCopyKey}`,
    vars?: Record<string, string | number>,
  ) =>
    translate(
      `${COPY_PREFIX[flow]}.${key.slice('payeeTrend.'.length) as SharedCopyKey}`,
      vars,
    );
  const { payees, unnamedCents, totalCents, months, history, loading } =
    usePayeeTrend(flow);
  const [openId, setOpenId] = useState<number | null>(null);

  if (loading) return <ScreenContainer />;

  if (payees.length === 0)
    return (
      <ScreenContainer>
        <Text style={styles.hint}>{t('payeeTrend.empty')}</Text>
      </ScreenContainer>
    );

  const [top, ...rest] = payees;
  const shareRatio = (payee: PayeeSummary) =>
    totalCents > 0 ? payee.totalCents / totalCents : 0;
  const share = (payee: PayeeSummary) => Math.round(shareRatio(payee) * 100);
  const topChange = payeeMonthOverAverage(top);

  // Below 1% each they rank on their own, under a line that says how many
  // there are and how much they add up to.
  const visibleRest = rest.filter((payee) => shareRatio(payee) >= 0.01);
  const smallRest = rest.filter((payee) => shareRatio(payee) < 0.01);
  const smallTotalCents = smallRest.reduce((sum, p) => sum + p.totalCents, 0);
  const smallSharePercent =
    totalCents > 0 ? Math.round((smallTotalCents / totalCents) * 100) : 0;

  const renderRow = (payee: PayeeSummary, i: number) => {
    const open = openId === payee.payeeId;
    const full = history.get(payee.payeeId) ?? payee;
    return (
      <View key={payee.payeeId}>
        {i > 0 ? <View style={styles.divider} /> : null}
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => setOpenId(open ? null : payee.payeeId)}
        >
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>
              {payee.name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {t('payeeTrend.paymentsCount', { count: payee.count })}
              {' · '}
              {t('payeeTrend.perMonth', {
                amount: formatMoney(payee.perMonthCents),
              })}
            </Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.amount}>{formatMoney(payee.totalCents)}</Text>
            <Text style={styles.amountLabel}>
              {t('payeeTrend.shareOfSpending', { percent: share(payee) })}
            </Text>
          </View>
          <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
        </Pressable>
        {open ? (
          <View style={styles.panel}>
            <MonthlyBarChart series={full.series} />
            <Text style={styles.hint}>
              {t('payeeTrend.rowDetail', {
                average: formatMoney(full.avgCents),
                months: full.series.length,
              })}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <GuideSection
          heading={t('payeeTrend.guideHeading')}
          body={t('payeeTrend.guideBody')}
        />
        <Text style={styles.hint}>
          {t('payeeTrend.window', { months: months.length })}
        </Text>

        <View style={styles.topCard}>
          <Text style={styles.topLabel}>{t('payeeTrend.topPayee')}</Text>
          <Text style={styles.topName} numberOfLines={1}>
            {top.name}
          </Text>
          <Text style={styles.topSub}>
            {t('payeeTrend.totalOverWindow', {
              amount: formatMoney(top.totalCents),
              percent: share(top),
            })}
            {' · '}
            {t('payeeTrend.paymentsCount', { count: top.count })}
          </Text>
          <MonthlyBarChart series={top.series} />
          {topChange != null ? (
            <Text style={styles.hint}>
              {topChange >= 0
                ? t('payeeTrend.lastMonthUp', { percent: topChange })
                : t('payeeTrend.lastMonthDown', {
                    percent: Math.abs(topChange),
                  })}
            </Text>
          ) : null}
        </View>

        {visibleRest.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>
              {t('payeeTrend.othersHeading')}
            </Text>
            <View style={styles.card}>{visibleRest.map(renderRow)}</View>
          </>
        ) : null}

        {smallRest.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>
              {t('payeeTrend.smallerHeading', {
                count: smallRest.length,
                percent: smallSharePercent,
              })}
            </Text>
            <View style={styles.card}>{smallRest.map(renderRow)}</View>
          </>
        ) : null}

        {unnamedCents > 0 ? (
          <Text style={styles.hint}>
            {t('payeeTrend.unnamed', {
              amount: formatMoney(unnamedCents),
            })}
          </Text>
        ) : null}

        <GuideSection
          heading={t('payeeTrend.guideBottomHeading')}
          body={t('payeeTrend.guideBottomBody')}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl, gap: spacing.sm },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  topCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.xs,
  },
  topLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  topName: { fontSize: 22, fontWeight: '700', color: colors.text },
  topSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowPressed: { backgroundColor: colors.border },
  rowText: { flex: 1 },
  name: { fontSize: 16, color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '600', color: colors.text },
  amountLabel: { fontSize: 10, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted },
  chevronOpen: { transform: [{ rotate: '90deg' }], color: colors.accent },
  panel: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
});
