import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { DateField } from '../../components/ui/DateField';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { LinkableNumberField } from '../../components/ui/LinkableNumberField';
import { CalcScreen, ResultsCard } from './CalcScreen';
import { ScheduleCard } from './ScheduleCard';
import { useCalcField, monthsFromYears } from './useCalcField';
import { buildAmortizationSchedule, monthlyPaymentCents } from '../../finance-tools/amortization';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';

// The plain table: any loan, its payment, and where every dollar of it goes.
// The account-scoped version (AmortizationCalculator, in an account's Tools
// section) pins the payment to that loan's real terms; here it's always
// derived from the three fields, which is what makes this the "what if" one.
export function AmortizationScreen() {
  const t = useT();
  const principal = useCalcField();
  const rate = useCalcField();
  const years = useCalcField('30');
  const extra = useCalcField();
  const [startDate, setStartDate] = useState(currentDateISO());

  const termMonths = monthsFromYears(years);
  const ready = principal.cents > 0 && termMonths > 0;

  const result = useMemo(() => {
    if (!ready) return null;
    const scheduledCents = monthlyPaymentCents(principal.cents, rate.bps, termMonths);
    const paymentCents = scheduledCents + extra.cents;
    const schedule = buildAmortizationSchedule(principal.cents, rate.bps, paymentCents, startDate, termMonths + 2);
    return {
      scheduledCents,
      paymentCents,
      schedule,
      totalInterestCents: schedule.reduce((sum, row) => sum + row.interestCents, 0),
      totalPaidCents: schedule.reduce((sum, row) => sum + row.paymentCents, 0),
    };
  }, [ready, principal.cents, rate.bps, termMonths, extra.cents, startDate]);

  return (
    <CalcScreen>
      <Card title={t('financeTools.inputs')}>
        <LinkableNumberField
          label={t('calculators.loanAmountLabel')}
          quantity="balance"
          value={principal.text}
          onChangeText={principal.set}
          linkedAccountId={principal.linkedAccountId}
          onLink={principal.link}
          accountFilter={(a) => a.account.type === 'mortgage' || a.account.type === 'loan' || a.account.type === 'credit_card'}
          placeholder={t('common.amountPlaceholder')}
        />
        <LinkableNumberField
          label={t('calculators.interestRateLabel')}
          quantity="rateBps"
          value={rate.text}
          onChangeText={rate.set}
          linkedAccountId={rate.linkedAccountId}
          onLink={rate.link}
          placeholder="6.5"
        />
        <TextField label={t('financeTools.termYears')} value={years.text} onChangeText={years.set} keyboardType="number-pad" />
        <TextField
          label={t('loanDetailsCard.extraPaymentLabel')}
          value={extra.text}
          onChangeText={extra.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <DateField label={t('financeTools.firstPaymentDate')} value={startDate} onChange={setStartDate} />
      </Card>

      <ResultsCard ready={ready}>
        {result ? (
          <>
            <ResultRow
              label={t('calculators.monthlyPaymentLabel')}
              value={t('common.perMonth', { amount: formatMoney(result.paymentCents) })}
              big
            />
            {extra.cents > 0 ? (
              <ResultRow label={t('financeTools.scheduledPayment')} value={formatMoney(result.scheduledCents)} tone="muted" />
            ) : null}
            <ResultRow
              label={t('financeTools.payoffDate')}
              value={
                result.schedule.length > 0
                  ? t('loanDetailsCard.payoffValue', {
                      date: result.schedule[result.schedule.length - 1].date,
                      months: result.schedule.length,
                    })
                  : t('loanDetailsCard.paymentTooLow')
              }
            />
            <ResultRow label={t('calculators.totalInterestLabel')} value={formatMoney(result.totalInterestCents)} tone="negative" />
            <ResultRow label={t('financeTools.totalPaid')} value={formatMoney(result.totalPaidCents)} />
          </>
        ) : null}
      </ResultsCard>

      <ScheduleCard
        title={t('amortizationSchedule.scheduleTitle')}
        columns={[
          t('amortizationSchedule.colDate'),
          t('amortizationSchedule.colPrincipal'),
          t('amortizationSchedule.colInterest'),
          t('amortizationSchedule.colBalance'),
        ]}
        rows={(result?.schedule ?? []).map((row) => [
          row.date,
          formatMoney(row.principalCents),
          formatMoney(row.interestCents),
          formatMoney(row.balanceCents),
        ])}
      />
    </CalcScreen>
  );
}
