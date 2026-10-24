import { Text } from 'react-native';
import { ResultRow } from '../../../components/ui/ResultRow';
import { Section, text } from './parts';
import type { PlanResult } from '../../../finance-tools/mortgagePlan';
import { formatMonthLabel } from '../../../domain/month';
import { formatMoney, formatPercent } from '../../../domain/money';
import { useT } from '../../../i18n';

// The term: what it pays down, what's left at renewal, and what renewing
// at a lower or higher rate would cost.
export function TermSection({
  r,
  renewalMonth,
  termYears,
}: {
  r: PlanResult;
  renewalMonth: string | null;
  termYears: number;
}) {
  const t = useT();
  return (
    <Section
      title={
        renewalMonth
          ? t('mortgagePlan.renewsHeading', {
              month: formatMonthLabel(renewalMonth),
            })
          : t('mortgagePlan.termHeading', { years: termYears || 1 })
      }
      summary={formatMoney(r.term.balanceCents)}
    >
      <ResultRow
        label={t('canadaPurchase.termInterest')}
        value={formatMoney(r.term.interestCents)}
        tone="negative"
      />
      <ResultRow
        label={t('canadaPurchase.termPrincipal')}
        value={formatMoney(r.term.principalCents)}
      />
      <ResultRow
        label={t('canadaPurchase.termBalance')}
        value={formatMoney(r.term.balanceCents)}
        big
      />
      {r.term.balanceCents > 0 ? (
        <>
          <Text style={text.subheading}>
            {t('mortgagePlan.renewalHeading')}
          </Text>
          {r.renewal.map((row) => (
            <ResultRow
              key={row.shockBps}
              label={
                row.shockBps === 0
                  ? t('mortgagePlan.renewalSame', {
                      rate: formatPercent(row.rateBps),
                    })
                  : t(
                      row.shockBps > 0
                        ? 'mortgagePlan.renewalUp'
                        : 'mortgagePlan.renewalDown',
                      {
                        shock: Math.abs(row.shockBps) / 100,
                        rate: formatPercent(row.rateBps),
                      },
                    )
              }
              value={`${formatMoney(row.monthlyPaymentCents)}${row.changeCents !== 0 ? `  ${row.changeCents > 0 ? '+' : '−'}${formatMoney(Math.abs(row.changeCents))}` : ''}`}
              tone={
                row.changeCents > 0
                  ? 'negative'
                  : row.changeCents < 0
                    ? 'positive'
                    : 'default'
              }
              hint={
                row.incomePercent != null
                  ? t('mortgagePlan.ofIncome', {
                      percent: row.incomePercent.toFixed(0),
                    })
                  : undefined
              }
            />
          ))}
        </>
      ) : null}
    </Section>
  );
}
