import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ChipRow } from '../../components/ui/ChipRow';
import { DateField } from '../../components/ui/DateField';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { UnitAmountField } from '../../components/ui/UnitAmountField';
import { CalcScreen, ResultsCard } from './CalcScreen';
import { ScheduleCard } from './ScheduleCard';
import { useCalcField } from './useCalcField';
import type { CalcField } from './useCalcField';
import { computePrepayment } from '../../finance-tools/chinaPrepayment';
import type { AdjustmentPlan, PrepaymentKind, RepaymentMethod } from '../../finance-tools/chinaPrepayment';
import { wanToCents } from '../../finance-tools/units';
import { currentDateISO } from '../../domain/month';
import { formatMoney, formatPercent } from '../../domain/money';
import { useT } from '../../i18n';

type AmountUnit = 'yuan' | 'wan';

// 提前还贷. Rendered in ¥ rather than the ledger's own currency — this models
// a Chinese mortgage contract, and a figure in 万元 shown with a dollar sign
// would be actively misleading.
const CNY = { symbol: '¥', locale: 'zh-CN' };

// The field holds one number; which currency unit it means is the toggle
// beside it. Everything past here is 分, like the rest of the app.
function amountCentsOf(field: CalcField, unit: AmountUnit): number {
  return unit === 'wan' ? wanToCents(field.number) : field.cents;
}

export function ChinaPrepaymentScreen() {
  const t = useT();
  const principal = useCalcField();
  const [principalUnit, setPrincipalUnit] = useState<AmountUnit>('wan');
  const rate = useCalcField();
  const termYears = useCalcField('30');
  const [method, setMethod] = useState<RepaymentMethod>('equalInstallment');
  const [startDate, setStartDate] = useState(currentDateISO());

  const [kind, setKind] = useState<PrepaymentKind>('partial');
  const amount = useCalcField();
  const [amountUnit, setAmountUnit] = useState<AmountUnit>('wan');
  const [prepayDate, setPrepayDate] = useState(currentDateISO());
  const [plan, setPlan] = useState<AdjustmentPlan>('shortenTerm');
  const newRate = useCalcField();

  const principalCents = amountCentsOf(principal, principalUnit);
  const amountCents = amountCentsOf(amount, amountUnit);
  const termMonths = Math.round(termYears.number * 12);
  const ready = principalCents > 0 && termMonths > 0 && rate.filled;

  const result = useMemo(
    () =>
      computePrepayment({
        contract: { principalCents, annualRateBps: rate.bps, termMonths, method, startDateIso: startDate },
        prepayDateIso: prepayDate,
        kind,
        amountCents,
        plan,
        // Blank means "the rate didn't change" — not a 0% loan.
        newAnnualRateBps: newRate.filled ? newRate.bps : undefined,
      }),
    [principalCents, rate.bps, termMonths, method, startDate, prepayDate, kind, amountCents, plan, newRate.filled, newRate.bps],
  );

  const money = (cents: number) => formatMoney(cents, CNY);
  // Nothing left to schedule: the prepayment cleared the whole balance.
  const cleared = ready && result.error == null && result.revised == null && result.remainingPrincipalCents > 0;

  return (
    <CalcScreen>
      <Card title={t('financeTools.loanContract')}>
        <UnitAmountField
          label={t('calculators.loanAmountLabel')}
          value={principal.text}
          onChangeText={principal.set}
          unit={principalUnit}
          onUnitChange={setPrincipalUnit}
          units={[
            { value: 'wan', label: t('financeTools.unitWan') },
            { value: 'yuan', label: t('financeTools.unitYuan') },
          ]}
          placeholder="100"
        />
        <TextField label={t('calculators.interestRateLabel')} value={rate.text} onChangeText={rate.set} keyboardType="decimal-pad" placeholder="4.2" />
        <TextField label={t('financeTools.termYears')} value={termYears.text} onChangeText={termYears.set} keyboardType="number-pad" />
        <ChipRow
          value={method}
          onChange={setMethod}
          options={[
            { value: 'equalInstallment', label: t('financeTools.equalInstallment') },
            { value: 'equalPrincipal', label: t('financeTools.equalPrincipal') },
          ]}
        />
        <DateField label={t('financeTools.contractStart')} value={startDate} onChange={setStartDate} />
      </Card>

      <Card title={t('financeTools.prepayment')}>
        <ChipRow
          value={kind}
          onChange={setKind}
          options={[
            { value: 'partial', label: t('financeTools.prepayPartial') },
            { value: 'full', label: t('financeTools.prepayFull') },
          ]}
        />
        <DateField label={t('financeTools.prepayDate')} value={prepayDate} onChange={setPrepayDate} />
        {kind === 'partial' ? (
          <>
            <UnitAmountField
              label={t('financeTools.prepayAmount')}
              value={amount.text}
              onChangeText={amount.set}
              unit={amountUnit}
              onUnitChange={setAmountUnit}
              units={[
                { value: 'wan', label: t('financeTools.unitWan') },
                { value: 'yuan', label: t('financeTools.unitYuan') },
              ]}
              placeholder="20"
            />
            <ChipRow
              value={plan}
              onChange={setPlan}
              options={[
                { value: 'shortenTerm', label: t('financeTools.shortenTerm') },
                { value: 'reducePayment', label: t('financeTools.reducePayment') },
              ]}
            />
            <TextField
              label={t('financeTools.newRateOptional')}
              value={newRate.text}
              onChangeText={newRate.set}
              keyboardType="decimal-pad"
              placeholder={t('financeTools.sameAsContract')}
            />
          </>
        ) : null}
      </Card>

      <ResultsCard ready={ready}>
        {result.error === 'paymentBelowInterest' ? (
          <ResultRow label={t('financeTools.revisedLoan')} value={t('loanDetailsCard.paymentTooLow')} tone="negative" />
        ) : (
          <>
            <ResultRow
              label={t('financeTools.interestSaved')}
              value={money(result.interestSavedCents)}
              big
              tone="positive"
              hint={
                newRate.filled && result.interestSavedFromPrepaymentCents !== result.interestSavedCents
                  ? t('financeTools.savedFromPrepaymentOnly', { amount: money(result.interestSavedFromPrepaymentCents) })
                  : undefined
              }
            />
            <ResultRow label={t('financeTools.prepayAmount')} value={money(result.prepayAmountCents)} />
            <ResultRow
              label={t('financeTools.periodsPaid')}
              value={t('financeTools.monthsValue', { months: result.paidPeriods })}
              hint={t('financeTools.paidSoFar', {
                principal: money(result.paidPrincipalCents),
                interest: money(result.paidInterestCents),
              })}
            />
            <ResultRow label={t('financeTools.remainingPrincipal')} value={money(result.remainingPrincipalCents)} />
            <ResultRow label={t('financeTools.remainingInterest')} value={money(result.remainingInterestCents)} />
            {cleared ? <ResultRow label={t('financeTools.revisedLoan')} value={t('financeTools.loanCleared')} tone="positive" /> : null}
          </>
        )}
      </ResultsCard>

      {result.original || result.revised ? (
        <Card title={t('financeTools.beforeAndAfter')}>
          {result.original ? (
            <>
              <ResultRow label={t('financeTools.originalPlan')} value="" tone="muted" />
              <ResultRow label={t('financeTools.firstPayment')} value={money(result.original.firstPaymentCents)} />
              <ResultRow
                label={t('financeTools.remainingTermMonths')}
                value={t('financeTools.monthsValue', { months: result.original.termMonths })}
              />
              <ResultRow label={t('calculators.totalInterestLabel')} value={money(result.original.totalInterestCents)} />
            </>
          ) : null}
          {result.revised ? (
            <>
              <ResultRow label={t('financeTools.revisedPlan')} value="" tone="muted" />
              <ResultRow label={t('financeTools.firstPayment')} value={money(result.revised.firstPaymentCents)} />
              {result.revised.monthlyDecrementCents > 0 ? (
                <ResultRow label={t('financeTools.monthlyDecrement')} value={money(result.revised.monthlyDecrementCents)} />
              ) : null}
              <ResultRow
                label={t('financeTools.remainingTermMonths')}
                value={t('financeTools.monthsValue', { months: result.revised.termMonths })}
              />
              <ResultRow label={t('financeTools.rate')} value={formatPercent(result.revised.annualRateBps)} />
              <ResultRow label={t('calculators.totalInterestLabel')} value={money(result.revised.totalInterestCents)} />
            </>
          ) : null}
        </Card>
      ) : null}

      <ScheduleCard
        title={t('financeTools.revisedSchedule')}
        columns={[
          t('amortizationSchedule.colDate'),
          t('financeTools.colPayment'),
          t('amortizationSchedule.colInterest'),
          t('amortizationSchedule.colBalance'),
        ]}
        rows={result.revisedSchedule.map((row) => [row.date, money(row.paymentCents), money(row.interestCents), money(row.balanceCents)])}
      />
    </CalcScreen>
  );
}
