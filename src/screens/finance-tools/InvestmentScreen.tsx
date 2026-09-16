import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ChipRow } from '../../components/ui/ChipRow';
import { DropdownField, DropdownOption } from '../../components/ui/DropdownField';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { CalcScreen, ResultsCard } from './CalcScreen';
import { ScheduleCard } from './ScheduleCard';
import { useCalcField } from './useCalcField';
import {
  buildAccumulationSchedule,
  effectiveAnnualRate,
  futureValueCents,
  solveAnnualReturnBps,
  solveContributionCents,
  solveStartingCents,
  solveYears,
} from '../../finance-tools/investment';
import type { CompoundFrequency, ContributionTiming, InvestmentInput } from '../../finance-tools/investment';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';

type SolveFor = 'end' | 'starting' | 'contribution' | 'return' | 'years';

const FREQUENCIES: { value: CompoundFrequency; labelKey: TranslationKey }[] = [
  { value: 'annually', labelKey: 'compound.annually' },
  { value: 'semiannually', labelKey: 'compound.semiannually' },
  { value: 'quarterly', labelKey: 'compound.quarterly' },
  { value: 'monthly', labelKey: 'compound.monthly' },
  { value: 'semimonthly', labelKey: 'compound.semimonthly' },
  { value: 'biweekly', labelKey: 'compound.biweekly' },
  { value: 'weekly', labelKey: 'compound.weekly' },
  { value: 'daily', labelKey: 'compound.daily' },
  { value: 'continuously', labelKey: 'compound.continuously' },
];

const TIMINGS: { value: ContributionTiming; labelKey: TranslationKey }[] = [
  { value: 'endOfMonth', labelKey: 'compound.endOfMonth' },
  { value: 'beginningOfMonth', labelKey: 'compound.beginningOfMonth' },
  { value: 'endOfYear', labelKey: 'compound.endOfYear' },
  { value: 'beginningOfYear', labelKey: 'compound.beginningOfYear' },
];

// Five questions, one form: any of the five figures can be the unknown, and
// the field for whichever one is being solved for is swapped out for the
// target balance. A separate screen per direction would be five copies of the
// same six inputs.
export function InvestmentScreen() {
  const t = useT();
  const [solveFor, setSolveFor] = useState<SolveFor>('end');
  const starting = useCalcField();
  const contribution = useCalcField();
  const [timing, setTiming] = useState<ContributionTiming>('endOfMonth');
  const years = useCalcField('20');
  const annualReturn = useCalcField('7');
  const [compound, setCompound] = useState<CompoundFrequency>('annually');
  const target = useCalcField();

  const input: InvestmentInput = useMemo(
    () => ({
      startingCents: starting.cents,
      years: years.number,
      annualReturnBps: annualReturn.bps,
      compound,
      contributionCents: contribution.cents,
      timing,
    }),
    [starting.cents, years.number, annualReturn.bps, compound, contribution.cents, timing],
  );

  const ready = solveFor === 'end' ? years.number > 0 : target.cents > 0 && years.number > 0;

  // Every solve returns one number in its own unit, then the whole plan is
  // re-run with it substituted in — so the summary and schedule below always
  // describe the same scenario, whichever field was the unknown.
  const resolved: InvestmentInput = useMemo(() => {
    if (!ready || solveFor === 'end') return input;
    if (solveFor === 'starting') return { ...input, startingCents: solveStartingCents(target.cents, input) };
    if (solveFor === 'contribution') return { ...input, contributionCents: solveContributionCents(target.cents, input) };
    if (solveFor === 'return') return { ...input, annualReturnBps: solveAnnualReturnBps(target.cents, input) };
    return { ...input, years: solveYears(target.cents, input) };
  }, [ready, solveFor, input, target.cents]);

  const result = futureValueCents(resolved);
  const schedule = useMemo(() => (ready ? buildAccumulationSchedule(resolved) : []), [ready, resolved]);
  const earPercent = effectiveAnnualRate(resolved.annualReturnBps, resolved.compound) * 100;

  return (
    <CalcScreen>
      <Card title={t('financeTools.solveFor')}>
        <ChipRow
          value={solveFor}
          onChange={setSolveFor}
          options={[
            { value: 'end', label: t('financeTools.solveEnd') },
            { value: 'starting', label: t('financeTools.solveStarting') },
            { value: 'contribution', label: t('financeTools.solveContribution') },
            { value: 'return', label: t('financeTools.solveReturn') },
            { value: 'years', label: t('financeTools.solveYears') },
          ]}
        />
      </Card>

      <Card title={t('financeTools.inputs')}>
        {solveFor !== 'end' ? (
          <TextField
            label={t('financeTools.targetBalance')}
            value={target.text}
            onChangeText={target.set}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
          />
        ) : null}
        {solveFor !== 'starting' ? (
          <TextField
            label={t('financeTools.startingAmount')}
            value={starting.text}
            onChangeText={starting.set}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
          />
        ) : null}
        {solveFor !== 'contribution' ? (
          <TextField
            label={t('financeTools.contribution')}
            value={contribution.text}
            onChangeText={contribution.set}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
          />
        ) : null}
        <DropdownField
          compact
          label={t('financeTools.contributionTiming')}
          valueLabel={t(TIMINGS.find((o) => o.value === timing)!.labelKey)}
        >
          {(close) =>
            TIMINGS.map((option) => (
              <DropdownOption
                key={option.value}
                label={t(option.labelKey)}
                selected={option.value === timing}
                onPress={() => {
                  setTiming(option.value);
                  close();
                }}
              />
            ))
          }
        </DropdownField>
        {solveFor !== 'years' ? (
          <TextField label={t('financeTools.years')} value={years.text} onChangeText={years.set} keyboardType="decimal-pad" />
        ) : null}
        {solveFor !== 'return' ? (
          <TextField
            label={t('financeTools.annualReturn')}
            value={annualReturn.text}
            onChangeText={annualReturn.set}
            keyboardType="decimal-pad"
          />
        ) : null}
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
        {solveFor === 'starting' ? (
          <ResultRow label={t('financeTools.startingAmount')} value={formatMoney(resolved.startingCents)} big tone="positive" />
        ) : solveFor === 'contribution' ? (
          <ResultRow label={t('financeTools.contribution')} value={formatMoney(resolved.contributionCents)} big tone="positive" />
        ) : solveFor === 'return' ? (
          <ResultRow label={t('financeTools.annualReturn')} value={`${(resolved.annualReturnBps / 100).toFixed(2)}%`} big tone="positive" />
        ) : solveFor === 'years' ? (
          <ResultRow label={t('financeTools.years')} value={resolved.years.toFixed(1)} big tone="positive" />
        ) : (
          <ResultRow label={t('financeTools.endBalance')} value={formatMoney(result.endBalanceCents)} big tone="positive" />
        )}
        {solveFor !== 'end' ? <ResultRow label={t('financeTools.endBalance')} value={formatMoney(result.endBalanceCents)} /> : null}
        <ResultRow label={t('financeTools.totalContributions')} value={formatMoney(result.totalContributionsCents)} />
        <ResultRow label={t('financeTools.totalInterestEarned')} value={formatMoney(result.totalInterestCents)} tone="positive" />
        <ResultRow
          label={t('financeTools.effectiveAnnualRate')}
          value={`${earPercent.toFixed(2)}%`}
          hint={t('financeTools.effectiveAnnualHint')}
        />
      </ResultsCard>

      <ScheduleCard
        title={t('financeTools.yearByYear')}
        columns={[
          t('financeTools.colYear'),
          t('financeTools.colStart'),
          t('financeTools.colAdded'),
          t('amortizationSchedule.colInterest'),
          t('financeTools.colEnd'),
        ]}
        rows={schedule.map((row) => [
          String(row.year),
          formatMoney(row.startBalanceCents),
          formatMoney(row.contributionCents),
          formatMoney(row.interestCents),
          formatMoney(row.endBalanceCents),
        ])}
      />
    </CalcScreen>
  );
}
