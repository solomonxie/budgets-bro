import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { DropdownField, DropdownOption } from '../../components/ui/DropdownField';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { AssumptionNote, CalcScreen, ResultsCard } from './CalcScreen';
import { ScheduleCard } from './ScheduleCard';
import { useCalcField } from './useCalcField';
import { buildAccumulationSchedule, effectiveAnnualRate, futureValueCents } from '../../finance-tools/investment';
import type { CompoundFrequency } from '../../finance-tools/investment';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';

const FREQUENCIES: { value: CompoundFrequency; labelKey: TranslationKey }[] = [
  { value: 'annually', labelKey: 'compound.annually' },
  { value: 'semiannually', labelKey: 'compound.semiannually' },
  { value: 'quarterly', labelKey: 'compound.quarterly' },
  { value: 'monthly', labelKey: 'compound.monthly' },
  { value: 'daily', labelKey: 'compound.daily' },
  { value: 'continuously', labelKey: 'compound.continuously' },
];

// One sum, one rate, no contributions — the question people ask about a GIC,
// a savings rate or "what would this be worth in ten years". It shares the
// Investment tool's engine with the contribution set to zero; what earns it a
// separate entry is the three fields, since the full form's five extra ones
// are exactly what makes that screen the wrong place to answer this.
export function CompoundInterestScreen() {
  const t = useT();
  const principal = useCalcField();
  const rate = useCalcField('5');
  const years = useCalcField('10');
  const [compound, setCompound] = useState<CompoundFrequency>('annually');

  const ready = principal.cents > 0 && years.number > 0;
  const input = useMemo(
    () => ({
      startingCents: principal.cents,
      years: years.number,
      annualReturnBps: rate.bps,
      compound,
      contributionCents: 0,
      timing: 'endOfYear' as const,
    }),
    [principal.cents, years.number, rate.bps, compound],
  );

  const result = futureValueCents(input);
  const schedule = useMemo(() => (ready ? buildAccumulationSchedule(input) : []), [ready, input]);
  const earPercent = effectiveAnnualRate(rate.bps, compound) * 100;
  const simpleInterestCents = Math.round((principal.cents * rate.bps * years.number) / 10000);

  return (
    <CalcScreen>
      <Card title={t('financeTools.inputs')}>
        <TextField
          label={t('financeTools.startingAmount')}
          value={principal.text}
          onChangeText={principal.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField label={t('calculators.interestRateLabel')} value={rate.text} onChangeText={rate.set} keyboardType="decimal-pad" />
        <TextField label={t('financeTools.years')} value={years.text} onChangeText={years.set} keyboardType="decimal-pad" />
        <DropdownField
          compact
          label={t('financeTools.compoundFrequency')}
          valueLabel={t(FREQUENCIES.find((o) => o.value === compound)!.labelKey)}
        >
          {(close) =>
            FREQUENCIES.map((option) => (
              <DropdownOption
                key={option.value}
                label={t(option.labelKey)}
                selected={option.value === compound}
                onPress={() => {
                  setCompound(option.value);
                  close();
                }}
              />
            ))
          }
        </DropdownField>
      </Card>

      <ResultsCard ready={ready}>
        <ResultRow label={t('financeTools.endBalance')} value={formatMoney(result.endBalanceCents)} big tone="positive" />
        <ResultRow label={t('financeTools.totalInterestEarned')} value={formatMoney(result.totalInterestCents)} tone="positive" />
        <ResultRow
          label={t('financeTools.effectiveAnnualRate')}
          value={`${earPercent.toFixed(2)}%`}
          hint={t('financeTools.effectiveAnnualHint')}
        />
        <ResultRow
          label={t('financeTools.compoundingBonus')}
          value={formatMoney(result.totalInterestCents - simpleInterestCents)}
          hint={t('financeTools.compoundingBonusHint', { amount: formatMoney(simpleInterestCents) })}
        />
        <AssumptionNote text={t('financeTools.compoundNote')} />
      </ResultsCard>

      <ScheduleCard
        title={t('financeTools.yearByYear')}
        columns={[t('financeTools.colYear'), t('financeTools.colStart'), t('amortizationSchedule.colInterest'), t('financeTools.colEnd')]}
        rows={schedule.map((row) => [
          String(row.year),
          formatMoney(row.startBalanceCents),
          formatMoney(row.interestCents),
          formatMoney(row.endBalanceCents),
        ])}
      />
    </CalcScreen>
  );
}
