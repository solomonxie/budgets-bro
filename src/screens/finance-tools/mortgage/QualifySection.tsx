import { ResultRow } from '../../../components/ui/ResultRow';
import { AssumptionNote } from '../CalcScreen';
import { Section } from './parts';
import {
  GDS_LIMIT_PERCENT,
  TDS_LIMIT_PERCENT,
} from '../../../finance-tools/canadianMortgage';
import type { PlanResult } from '../../../finance-tools/mortgagePlan';
import { formatMoney, formatPercent } from '../../../domain/money';
import { useT } from '../../../i18n';

export function QualifySection({ r }: { r: PlanResult }) {
  const t = useT();
  const q = r.qualifying;
  return (
    <Section
      title={t('mortgagePlan.qualifyHeading')}
      summary={formatMoney(q.required.requiredAnnualCents)}
    >
      <ResultRow
        label={t('mortgagePlan.stressRate')}
        value={formatPercent(q.stressRateBps)}
      />
      <ResultRow
        label={t('mortgagePlan.stressPayment')}
        value={formatMoney(q.stressPaymentCents)}
      />
      <ResultRow
        label={t('requiredIncome.gdsCosts')}
        value={formatMoney(q.required.gdsMonthlyCents)}
      />
      <ResultRow
        label={t('requiredIncome.tdsCosts')}
        value={formatMoney(q.required.tdsMonthlyCents)}
      />
      <ResultRow
        label={t('requiredIncome.requiredAnnual')}
        value={formatMoney(q.required.requiredAnnualCents)}
        big
        hint={t(
          q.required.boundBy === 'gds'
            ? 'mortgagePlan.boundGds'
            : 'mortgagePlan.boundTds',
        )}
      />
      {q.gdsPercent != null && q.tdsPercent != null ? (
        <>
          <ResultRow
            label={t('mortgagePlan.gdsRatio')}
            value={`${q.gdsPercent.toFixed(1)}%`}
            tone={q.gdsPercent <= GDS_LIMIT_PERCENT ? 'positive' : 'negative'}
          />
          <ResultRow
            label={t('mortgagePlan.tdsRatio')}
            value={`${q.tdsPercent.toFixed(1)}%`}
            tone={q.tdsPercent <= TDS_LIMIT_PERCENT ? 'positive' : 'negative'}
          />
        </>
      ) : null}
      <AssumptionNote text={t('mortgagePlan.qualifyNote')} />
    </Section>
  );
}
