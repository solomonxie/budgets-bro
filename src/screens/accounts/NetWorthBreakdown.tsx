import { StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '../../domain/money';
import { formatMonthLabel } from '../../domain/month';
import { localeTag, useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { NetWorthTrendPoint } from '../../domain/netWorthTrend';
import type { Account } from '../../domain/types';

const SOURCE_LABELS: Record<string, TranslationKey> = {
  reading: 'netWorthBreakdown.sourceReading',
  purchasePrice: 'netWorthBreakdown.sourcePurchasePrice',
  oldestReading: 'netWorthBreakdown.sourceOldestReading',
  ledger: 'netWorthBreakdown.sourceLedger',
  derived: 'netWorthBreakdown.sourceDerived',
};

// Every account's part in one month of the line above, for the month that
// month looks wrong in.
//
// A net worth is a dozen different derivations added together — a logged
// valuation here, a remaining principal there, a ledger sum somewhere else —
// so "that number is wrong" is never actionable on its own. This says which
// account produced what, and which rule answered for it: an account showing
// a debt with no home beside it, or a value that fell back to the ledger
// when you expected a valuation, is visible at a glance.
export function NetWorthBreakdown({
  point,
  accounts,
}: {
  point: NetWorthTrendPoint;
  accounts: Account[];
}) {
  const { t, language } = useI18n();
  const nameOf = (id: number) =>
    accounts.find((a) => a.id === id)?.name ?? `#${id}`;

  // Biggest contribution first, debts last — the month is read top-down,
  // and what made it is whatever is at the ends of that list.
  const rows = point.contributions
    .map((c) => ({
      ...c,
      totalCents: c.balanceCents + (c.houseValueCents ?? 0),
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        {t('netWorthBreakdown.heading', {
          month: formatMonthLabel(point.month, localeTag(language)),
        })}
      </Text>
      {point.contributions.length === 0 ? (
        <Text style={styles.hint}>{t('netWorthBreakdown.noAccounts')}</Text>
      ) : null}
      {/* What an account put into the total, which for a mortgage is the
          equity — the debt alone reads as a catastrophe next to a house
          that isn't on the row. The debt and the home are spelled out
          underneath, since equity is the difference of two figures and
          neither is obvious from the other. */}
      {rows.map(({ totalCents, ...c }) => {
        return (
          <View key={c.accountId} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.name}>{nameOf(c.accountId)}</Text>
              <Text style={styles.sub}>
                {[
                  t(
                    SOURCE_LABELS[c.source] ?? 'netWorthBreakdown.sourceLedger',
                  ),
                ]
                  .concat(
                    c.houseValueCents != null
                      ? [
                          t('netWorthBreakdown.homeValue', {
                            amount: formatMoney(c.houseValueCents),
                          }),
                          t('netWorthBreakdown.owed', {
                            amount: formatMoney(-c.balanceCents),
                          }),
                        ]
                      : [],
                  )
                  .join(' · ')}
              </Text>
            </View>
            <Text
              style={[
                styles.amount,
                totalCents < 0 ? styles.negative : styles.positive,
              ]}
            >
              {formatMoney(totalCents)}
            </Text>
          </View>
        );
      })}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>{t('accounts.netWorth')}</Text>
        <Text
          style={[
            styles.amount,
            point.netWorthCents < 0 ? styles.negative : styles.positive,
          ]}
        >
          {formatMoney(point.netWorthCents)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  hint: { fontSize: 12, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowMain: { flex: 1 },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    marginTop: 2,
  },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  sub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  totalLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  amount: { fontSize: 14, fontWeight: '700' },
  negative: { color: colors.negative },
  positive: { color: colors.positive },
});
