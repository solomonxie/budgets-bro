import { Card } from '../../../components/ui/Card';
import { ResultRow } from '../../../components/ui/ResultRow';
import { AssumptionNote } from '../CalcScreen';
import { SliderField, steps } from './SliderField';
import { Chips, YearChoice } from './parts';
import type { HeldMortgage, HeldTerms } from './heldTerms';
import type { PlanInputs } from './planInputs';
import { RATE_STOPS, TERM_YEARS } from './constants';
import type { Compounding } from '../../../finance-tools/canadianMortgage';
import { formatMonthLabel } from '../../../domain/month';
import { formatMoney, formatPercent } from '../../../domain/money';
import { useT } from '../../../i18n';

// A real mortgage: what's owed, at what rate, paid how — and the few
// figures the account doesn't hold.
export function HeldCard({
  held,
  terms,
  inputs,
  renewalMonth,
  triggerBps,
}: {
  held: HeldMortgage;
  terms: HeldTerms;
  inputs: PlanInputs;
  renewalMonth: string | null;
  triggerBps: number | null;
}) {
  const t = useT();
  const { price, rate, termYears, compounding, setCompounding } = inputs;
  const triggerHit = triggerBps != null && terms.rateBps >= triggerBps;
  return (
    <Card title={held.entry.account.name}>
      <ResultRow
        label={t('financeTools.balance')}
        value={formatMoney(terms.owed)}
        big
      />
      <ResultRow
        label={t('financeTools.rate')}
        value={formatPercent(terms.rateBps)}
      />
      <ResultRow
        label={t('mortgagePlan.monthlyPayment')}
        value={formatMoney(terms.payment)}
        hint={t(
          terms.paymentFromLedger
            ? 'mortgagePlan.paymentFromLedger'
            : 'mortgagePlan.paymentFromTerms',
        )}
      />
      {renewalMonth ? (
        <ResultRow
          label={t('mortgagePlan.renews')}
          value={formatMonthLabel(renewalMonth)}
          hint={t('mortgagePlan.renewsHint')}
        />
      ) : null}
      {triggerBps != null ? (
        <ResultRow
          label={t('mortgagePlan.triggerRate')}
          value={formatPercent(triggerBps)}
          tone={triggerHit ? 'negative' : 'muted'}
          hint={t(
            triggerHit ? 'mortgagePlan.triggerHit' : 'mortgagePlan.triggerHint',
          )}
        />
      ) : null}
      {held.homeValueCents != null ? (
        <ResultRow
          label={t('financeTools.equity')}
          value={formatMoney(held.homeValueCents - terms.owed)}
          tone={held.homeValueCents >= terms.owed ? 'positive' : 'negative'}
        />
      ) : (
        <SliderField
          label={t('mortgagePlan.homeValue')}
          field={price}
          kind="money"
          around={10_000}
          empty={800_000}
        />
      )}
      {held.rateBps == null ? (
        <SliderField
          label={t('calculators.interestRateLabel')}
          field={rate}
          kind="percent"
          stops={RATE_STOPS}
          empty={4.5}
        />
      ) : null}
      {renewalMonth ? (
        <YearChoice
          label={t('mortgagePlan.termLengthYears')}
          field={termYears}
          years={TERM_YEARS}
          hint={t('mortgagePlan.termLengthHint')}
        />
      ) : (
        <SliderField
          label={t('mortgagePlan.termLeftYears')}
          field={termYears}
          kind="number"
          stops={TERM_LEFT_STOPS}
          unit={t('mortgagePlan.yearsUnit')}
          hint={t('mortgagePlan.termLeftHint')}
        />
      )}
      <Chips
        options={[
          { value: 'semiAnnual', label: t('canadaPurchase.rateFixed') },
          { value: 'monthly', label: t('canadaPurchase.rateVariable') },
        ]}
        value={compounding}
        onChange={(v) => setCompounding(v as Compounding)}
      />
      <AssumptionNote text={t('mortgagePlan.heldNote')} />
    </Card>
  );
}

const TERM_LEFT_STOPS = steps(0, 10, 0.5);
