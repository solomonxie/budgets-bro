import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { GuideSection } from '../../components/ui/GuideSection';
import { MonthlyBarChart } from '../../components/ui/MonthlyBarChart';
import { usePayeeTrend } from '../../hooks/usePayeeTrend';
import { payeeMonthOverAverage } from '../../domain/payeeTrend';
import type { PayeeSummary } from '../../domain/payeeTrend';
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
// is for. The rest open in place, the same as Tracked Prices: the
// ranking is the frame of reference, and pushing a detail page would cost
// you your place in it.
export function PayeeTrendScreen() {
  const t = useT();
  const { payees, unnamedCents, totalCents, months, history, loading } =
    usePayeeTrend();
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

  // Below 1% each, a dozen of these say nothing on their own — they're worth
  // seeing as one line, not a scroll of names nobody would recognise a
  // pattern in.
  const visibleRest = rest.filter((payee) => shareRatio(payee) >= 0.01);
  const smallRest = rest.filter((payee) => shareRatio(payee) < 0.01);
  const smallTotalCents = smallRest.reduce((sum, p) => sum + p.totalCents, 0);
  const smallCount = smallRest.reduce((sum, p) => sum + p.count, 0);
  const smallSharePercent =
    totalCents > 0 ? Math.round((smallTotalCents / totalCents) * 100) : 0;

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

        {rest.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>
              {t('payeeTrend.othersHeading')}
            </Text>
            <View style={styles.card}>
              {visibleRest.map((payee, i) => {
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
                          {t('payeeTrend.paymentsCount', {
                            count: payee.count,
                          })}
                          {' · '}
                          {t('payeeTrend.perMonth', {
                            amount: formatMoney(payee.perMonthCents),
                          })}
                        </Text>
                      </View>
                      <View style={styles.rowRight}>
                        <Text style={styles.amount}>
                          {formatMoney(payee.totalCents)}
                        </Text>
                        <Text style={styles.amountLabel}>
                          {t('payeeTrend.shareOfSpending', {
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
                        <MonthlyBarChart
                          series={(history.get(payee.payeeId) ?? payee).series}
                        />
                        <Text style={styles.hint}>
                          {t('payeeTrend.rowDetail', {
                            average: formatMoney(
                              (history.get(payee.payeeId) ?? payee).avgCents,
                            ),
                            months: (history.get(payee.payeeId) ?? payee).series
                              .length,
                          })}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {smallRest.length > 0 ? (
                <View>
                  {visibleRest.length > 0 ? (
                    <View style={styles.divider} />
                  ) : null}
                  <View style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {t('payeeTrend.smallerPayments')}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {t('payeeTrend.payeeCount', {
                          count: smallRest.length,
                        })}
                        {' · '}
                        {t('payeeTrend.paymentsCount', {
                          count: smallCount,
                        })}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.amount}>
                        {formatMoney(smallTotalCents)}
                      </Text>
                      <Text style={styles.amountLabel}>
                        {t('payeeTrend.shareOfSpending', {
                          percent: smallSharePercent,
                        })}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
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
