import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ChipRow } from '../../components/ui/ChipRow';
import { DateField } from '../../components/ui/DateField';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { LinkableNumberField } from '../../components/ui/LinkableNumberField';
import { CalcScreen, ResultsCard } from './CalcScreen';
import { ScheduleCard } from './ScheduleCard';
import { useCalcField } from './useCalcField';
import { addMonths, buildAmortizationSchedule } from '../../finance-tools/amortization';
import { biweeklyEquivalentMonthlyCents, buildScheduleWithExtras, comparePayoff } from '../../finance-tools/payoff';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import type { AccountWithBalance } from '../../db/repositories/accountsRepo';

type Mode = 'extra' | 'biweekly';

// "What do extra payments actually buy me" — for a mortgage and for a card or
// student loan alike. One component behind both registry entries: the maths
// and the form are identical, only which accounts a field can pull from
// differs, so a second copy would drift for no gain.
export function PayoffScreen({ accountFilter }: { accountFilter: (account: AccountWithBalance) => boolean }) {
  const t = useT();
  const balance = useCalcField();
  const rate = useCalcField();
  const payment = useCalcField();
  const [mode, setMode] = useState<Mode>('extra');
  const extraMonthly = useCalcField();
  const extraYearly = useCalcField();
  const [extraYearlyDate, setExtraYearlyDate] = useState(currentDateISO());
  const oneTime = useCalcField();
  const [oneTimeDate, setOneTimeDate] = useState(addMonths(currentDateISO(), 1));

  const today = currentDateISO();
  const ready = balance.cents > 0 && payment.cents > 0;

  const result = useMemo(() => {
    if (!ready) return null;
    const baseline = buildAmortizationSchedule(balance.cents, rate.bps, payment.cents, today);
    const accelerated =
      mode === 'biweekly'
        ? buildAmortizationSchedule(balance.cents, rate.bps, biweeklyEquivalentMonthlyCents(payment.cents), today)
        : buildScheduleWithExtras(balance.cents, rate.bps, payment.cents, today, {
            monthlyCents: extraMonthly.cents,
            yearlyCents: extraYearly.cents,
            yearlyStartDateIso: extraYearlyDate,
            oneTimeCents: oneTime.cents,
            oneTimeDateIso: oneTimeDate,
          });
    // A payment that doesn't cover the accruing interest produces no
    // schedule at all — say that instead of a comparison against nothing.
    if (baseline.length === 0) return { tooLow: true as const };
    return { tooLow: false as const, baseline, accelerated, comparison: comparePayoff(baseline, accelerated) };
  }, [
    ready,
    balance.cents,
    rate.bps,
    payment.cents,
    mode,
    extraMonthly.cents,
    extraYearly.cents,
    extraYearlyDate,
    oneTime.cents,
    oneTimeDate,
    today,
  ]);

  return (
    <CalcScreen>
      <Card title={t('financeTools.inputs')}>
        <LinkableNumberField
          label={t('financeTools.currentBalance')}
          quantity="balance"
          value={balance.text}
          onChangeText={balance.set}
          linkedAccountId={balance.linkedAccountId}
          onLink={balance.link}
          accountFilter={accountFilter}
          placeholder={t('common.amountPlaceholder')}
        />
        <LinkableNumberField
          label={t('calculators.interestRateLabel')}
          quantity="rateBps"
          value={rate.text}
          onChangeText={rate.set}
          linkedAccountId={rate.linkedAccountId}
          onLink={rate.link}
          accountFilter={accountFilter}
          placeholder="6.5"
        />
        <LinkableNumberField
          label={t('financeTools.currentPayment')}
          quantity="monthlyPayment"
          value={payment.text}
          onChangeText={payment.set}
          linkedAccountId={payment.linkedAccountId}
          onLink={payment.link}
          accountFilter={accountFilter}
          placeholder={t('common.amountPlaceholder')}
        />
      </Card>

      <Card title={t('financeTools.acceleration')}>
        <ChipRow
          value={mode}
          onChange={setMode}
          options={[
            { value: 'extra', label: t('financeTools.modeExtra') },
            { value: 'biweekly', label: t('financeTools.modeBiweekly') },
          ]}
        />
        {mode === 'extra' ? (
          <>
            <TextField
              label={t('loanDetailsCard.extraPaymentLabel')}
              value={extraMonthly.text}
              onChangeText={extraMonthly.set}
              keyboardType="decimal-pad"
              placeholder={t('common.amountPlaceholder')}
            />
            <TextField
              label={t('financeTools.extraYearly')}
              value={extraYearly.text}
              onChangeText={extraYearly.set}
              keyboardType="decimal-pad"
              placeholder={t('common.amountPlaceholder')}
            />
            {extraYearly.cents > 0 ? (
              <DateField label={t('financeTools.extraYearlyFrom')} value={extraYearlyDate} onChange={setExtraYearlyDate} />
            ) : null}
            <TextField
              label={t('financeTools.oneTimePayment')}
              value={oneTime.text}
              onChangeText={oneTime.set}
              keyboardType="decimal-pad"
              placeholder={t('common.amountPlaceholder')}
            />
            {oneTime.cents > 0 ? (
              <DateField label={t('financeTools.oneTimeOn')} value={oneTimeDate} onChange={setOneTimeDate} />
            ) : null}
          </>
        ) : (
          <ResultRow
            label={t('financeTools.biweeklyEquivalent')}
            value={t('common.perMonth', { amount: formatMoney(biweeklyEquivalentMonthlyCents(payment.cents)) })}
            hint={t('financeTools.biweeklyNote')}
          />
        )}
      </Card>

      <ResultsCard ready={ready}>
        {result?.tooLow ? (
          <ResultRow label={t('financeTools.payoffDate')} value={t('loanDetailsCard.paymentTooLow')} tone="negative" />
        ) : result ? (
          <>
            <ResultRow
              label={t('financeTools.interestSaved')}
              value={formatMoney(result.comparison.interestSavedCents)}
              big
              tone="positive"
              hint={t('financeTools.percentLessInterest', { percent: result.comparison.percentLessInterest.toFixed(1) })}
            />
            <ResultRow
              label={t('financeTools.timeSaved')}
              value={t('financeTools.monthsValue', { months: result.comparison.monthsSaved })}
              tone="positive"
            />
            <ResultRow
              label={t('financeTools.payoffBaseline')}
              value={t('loanDetailsCard.payoffValue', {
                date: result.baseline[result.baseline.length - 1].date,
                months: result.baseline.length,
              })}
            />
            <ResultRow
              label={t('financeTools.payoffAccelerated')}
              value={t('loanDetailsCard.payoffValue', {
                date: result.accelerated[result.accelerated.length - 1].date,
                months: result.accelerated.length,
              })}
            />
            <ResultRow label={t('financeTools.interestBaseline')} value={formatMoney(result.comparison.baselineInterestCents)} />
            <ResultRow label={t('financeTools.interestAccelerated')} value={formatMoney(result.comparison.acceleratedInterestCents)} />
          </>
        ) : null}
      </ResultsCard>

      <ScheduleCard
        title={t('financeTools.acceleratedSchedule')}
        columns={[
          t('amortizationSchedule.colDate'),
          t('financeTools.colPayment'),
          t('amortizationSchedule.colInterest'),
          t('amortizationSchedule.colBalance'),
        ]}
        rows={
          result && !result.tooLow
            ? result.accelerated.map((row) => [
                row.date,
                formatMoney(row.paymentCents),
                formatMoney(row.interestCents),
                formatMoney(row.balanceCents),
              ])
            : []
        }
      />
    </CalcScreen>
  );
}

export function MortgagePayoffScreen() {
  return <PayoffScreen accountFilter={(a) => a.account.type === 'mortgage'} />;
}

export function LoanPayoffScreen() {
  return <PayoffScreen accountFilter={(a) => a.account.type === 'loan' || a.account.type === 'credit_card'} />;
}
