import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CAR_LOAN_RULE,
  MORTGAGE_RULE,
  RAMSEY_MAX_TERM_MONTHS,
  healthLevel,
  interestSharePercent,
  loanToValuePercent,
  paymentSharePercent,
  rateShocks,
  stressTest,
} from '../../finance-tools/debtHealth';
import type { DebtHealthLevel } from '../../finance-tools/debtHealth';
import { useTakeHomeIncome } from '../../hooks/useTakeHomeIncome';
import { InfoButton } from '../../components/ui/InfoButton';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { LoanPayoff } from './LoanDetailsCard';

const LEVEL_COLOR: Record<DebtHealthLevel, string> = {
  healthy: colors.positive,
  stretched: colors.amber,
  atRisk: colors.negative,
};

const LEVEL_KEY = {
  healthy: 'debtHealth.healthy',
  stretched: 'debtHealth.stretched',
  atRisk: 'debtHealth.atRisk',
} as const;

const pct = (n: number) => `${n.toFixed(1)}%`;

// Folded by default, and income isn't read until it opens.
export function DebtHealthSection({
  isMortgage,
  payoff,
  termMonths,
  houseValueCents,
}: {
  isMortgage: boolean;
  payoff: LoanPayoff | null;
  termMonths: number | null;
  houseValueCents: number | null;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const incomeCents = useTakeHomeIncome(expanded);
  const rule = isMortgage ? MORTGAGE_RULE : CAR_LOAN_RULE;

  const health = useMemo(() => {
    if (!payoff || incomeCents == null) return null;
    const loan = {
      owedCents: payoff.owedCents,
      rateBps: payoff.rateBps,
      remainingMonths: payoff.months,
      monthlyIncomeCents: incomeCents,
    };
    const share = paymentSharePercent(payoff.paymentCents, incomeCents);
    return {
      share,
      level: share == null ? null : healthLevel(share, rule),
      stress: isMortgage ? stressTest(loan, rule) : null,
      shocks: isMortgage ? rateShocks(loan, rule) : [],
      interestShare: interestSharePercent(
        payoff.owedCents,
        payoff.rateBps,
        payoff.paymentCents,
      ),
      ltv: isMortgage
        ? loanToValuePercent(payoff.owedCents, houseValueCents)
        : null,
    };
  }, [payoff, incomeCents, rule, isMortgage, houseValueCents]);

  // A comfortable payment that fails the stress test is not comfortable.
  const overall: DebtHealthLevel | null =
    health?.level === 'healthy' && health.stress?.level === 'atRisk'
      ? 'stretched'
      : (health?.level ?? null);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.label}>{t('debtHealth.label')}</Text>
        <View style={styles.headerRight}>
          {overall ? (
            <Text style={[styles.badge, { color: LEVEL_COLOR[overall] }]}>
              {t(LEVEL_KEY[overall])}
            </Text>
          ) : null}
          <Text style={styles.chevron}>{expanded ? '▾' : '›'}</Text>
        </View>
      </Pressable>
      {expanded ? (
        !payoff ? (
          <Text style={styles.hint}>{t('debtHealth.needsTerms')}</Text>
        ) : incomeCents == null ? null : incomeCents <= 0 || !health ? (
          <Text style={styles.hint}>{t('debtHealth.noIncome')}</Text>
        ) : (
          <>
            <Row
              label={t('debtHealth.takeHome')}
              value={t('common.perMonth', { amount: formatMoney(incomeCents) })}
            />
            <Row
              label={t('debtHealth.paymentShare')}
              value={`${formatMoney(payoff.paymentCents)} · ${pct(health.share!)}`}
              level={health.level}
            />
            <Text style={styles.hint}>
              {t(isMortgage ? 'debtHealth.mortgageRule' : 'debtHealth.carRule', {
                healthy: rule.healthyMaxPercent,
                stretched: rule.stretchedMaxPercent,
              })}
            </Text>
            {health.stress ? (
              <Row
                label={t('debtHealth.stressTest', {
                  rate: (health.stress.rateBps / 100).toFixed(2),
                })}
                value={`${formatMoney(health.stress.paymentCents)} · ${pct(health.stress.percent!)}`}
                level={health.stress.level}
              />
            ) : null}
            {health.shocks.map((shock) => (
              <Row
                key={shock.rateBps}
                label={t('debtHealth.rateShock', {
                  add: (shock.rateBps - payoff.rateBps) / 100,
                  rate: (shock.rateBps / 100).toFixed(2),
                })}
                value={`${formatMoney(shock.paymentCents)} · ${pct(shock.percent!)}`}
                level={shock.level}
              />
            ))}
            {health.interestShare != null ? (
              <Row
                label={t('debtHealth.interestShare')}
                value={pct(health.interestShare)}
              />
            ) : null}
            {health.ltv != null ? (
              <Row
                label={t('debtHealth.ltv')}
                value={t('debtHealth.ltvValue', {
                  ltv: pct(health.ltv),
                  equity: pct(Math.max(0, 100 - health.ltv)),
                })}
                level={health.ltv <= 80 ? 'healthy' : 'stretched'}
              />
            ) : null}
            {isMortgage && termMonths != null ? (
              <Row
                label={t('debtHealth.term')}
                value={t('debtHealth.termValue', {
                  years: Math.round(termMonths / 12),
                })}
                level={
                  termMonths <= RAMSEY_MAX_TERM_MONTHS ? 'healthy' : 'stretched'
                }
              />
            ) : null}
            <InfoButton
              label={t('common.howThisWorks')}
              title={t('debtHealth.infoTitle')}
              paragraphs={
                isMortgage
                  ? [
                      t('debtHealth.infoIncome'),
                      t('debtHealth.infoMortgage'),
                      t('debtHealth.infoStress'),
                    ]
                  : [t('debtHealth.infoIncome'), t('debtHealth.infoCar')]
              }
              closeLabel={t('common.done')}
            />
          </>
        )
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  level,
}: {
  label: string;
  value: string;
  level?: DebtHealthLevel | null;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, level && { color: LEVEL_COLOR[level] }]}>
        {value}
      </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  badge: { fontSize: 13, fontWeight: '700' },
  chevron: { fontSize: 14, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  rowLabel: { flex: 1, fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.text },
});
