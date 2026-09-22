import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { GuideSection } from '../../components/ui/GuideSection';
import { PayeeMonthlyChart } from './PayeeMonthlyChart';
import { usePayeeInsights } from '../../hooks/usePayeeInsights';
import { payeeMonthOverAverage } from '../../domain/payeeInsights';
import type { PayeeSummary } from '../../domain/payeeInsights';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Who the money actually goes to. The category breakdown says what kind of
// spending it was; this says whose hand it ended up in, which is the half
// you can do something about — you can't stop buying groceries, but you can
// stop buying them there.
//
// Top payee gets the chart open, because that one answer is what the page
// is for. The rest open in place, the same as Purchase Insights: the
// ranking is the frame of reference, and pushing a detail page would cost
// you your place in it.
export function PayeeInsightsScreen() {
  const t = useT();
  const { payees, unnamedCents, totalCents, months, history, loading } =
    usePayeeInsights();
  const [openId, setOpenId] = useState<number | null>(null);

  if (loading) return <ScreenContainer />;

  if (payees.length === 0)
    return (
      <ScreenContainer>
        <Text style={styles.hint}>{t('payeeInsights.empty')}</Text>
      </ScreenContainer>
    );

  const [top, ...rest] = payees;
  const share = (payee: PayeeSummary) =>
    totalCents > 0 ? Math.round((payee.totalCents / totalCents) * 100) : 0;
  const topChange = payeeMonthOverAverage(top);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <GuideSection
          heading={t('payeeInsights.guideHeading')}
          body={t('payeeInsights.guideBody')}
        />
        <Text style={styles.hint}>
          {t('payeeInsights.window', { months: months.length })}
        </Text>

        <View style={styles.topCard}>
          <Text style={styles.topLabel}>{t('payeeInsights.topPayee')}</Text>
          <Text style={styles.topName} numberOfLines={1}>
            {top.name}
          </Text>
          <Text style={styles.topSub}>
            {t('payeeInsights.totalOverWindow', {
              amount: formatMoney(top.totalCents),
              percent: share(top),
            })}
            {' · '}
            {t('payeeInsights.paymentsCount', { count: top.count })}
          </Text>
          <PayeeMonthlyChart series={top.series} />
          {topChange != null ? (
            <Text style={styles.hint}>
              {topChange >= 0
                ? t('payeeInsights.lastMonthUp', { percent: topChange })
                : t('payeeInsights.lastMonthDown', {
                    percent: Math.abs(topChange),
                  })}
            </Text>
          ) : null}
        </View>

        {rest.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>
              {t('payeeInsights.othersHeading')}
            </Text>
            <View style={styles.card}>
              {rest.map((payee, i) => {
                const open = openId === payee.payeeId;
                return (
                  <View key={payee.payeeId}>
                    {i > 0 ? <View style={styles.divider} /> : null}
                    <Pressable
                      style={({ pressed }) => [
                        styles.row,
                        pressed && styles.rowPressed,
                      ]}
                      onPress={() => setOpenId(open ? null : payee.payeeId)}
                    >
                      <View style={styles.rowText}>
                        <Text style={styles.name} numberOfLines={1}>
                          {payee.name}
                        </Text>
                        <Text style={styles.sub} numberOfLines={1}>
                          {t('payeeInsights.paymentsCount', {
                            count: payee.count,
                          })}
                          {' · '}
                          {t('payeeInsights.perMonth', {
                            amount: formatMoney(payee.perMonthCents),
                          })}
                        </Text>
                      </View>
                      <View style={styles.rowRight}>
                        <Text style={styles.amount}>
                          {formatMoney(payee.totalCents)}
                        </Text>
                        <Text style={styles.amountLabel}>
                          {t('payeeInsights.shareOfSpending', {
                            percent: share(payee),
                          })}
                        </Text>
                      </View>
                      <Text
                        style={[styles.chevron, open && styles.chevronOpen]}
                      >
                        ›
                      </Text>
                    </Pressable>
                    {open ? (
                      <View style={styles.panel}>
                        <PayeeMonthlyChart
                          series={(history.get(payee.payeeId) ?? payee).series}
                        />
                        <Text style={styles.hint}>
                          {t('payeeInsights.rowDetail', {
                            average: formatMoney(
                              (history.get(payee.payeeId) ?? payee).avgCents,
                            ),
                            months: (history.get(payee.payeeId) ?? payee)
                              .monthsPaid,
                          })}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {unnamedCents > 0 ? (
          <Text style={styles.hint}>
            {t('payeeInsights.unnamed', {
              amount: formatMoney(unnamedCents),
            })}
          </Text>
        ) : null}

        <GuideSection
          heading={t('payeeInsights.guideBottomHeading')}
          body={t('payeeInsights.guideBottomBody')}
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
