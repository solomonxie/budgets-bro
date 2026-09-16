import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ChipRow } from '../../components/ui/ChipRow';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { LinkableNumberField } from '../../components/ui/LinkableNumberField';
import { AssumptionNote, CalcScreen, ResultsCard } from './CalcScreen';
import { useCalcField, monthsFromYears } from './useCalcField';
import { compareRefinance, payoffMonthsAtCurrentPayment } from '../../finance-tools/refinance';
import { addMonths } from '../../finance-tools/amortization';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';

type CostHandling = 'payUpFront' | 'rollIn';

// Break-even leads, because a lower rate on its own decides nothing: what
// matters is whether the closing costs come back before you move or refinance
// again.
export function RefinanceScreen() {
  const t = useT();
  const balance = useCalcField();
  const currentRate = useCalcField();
  const remainingMonths = useCalcField();
  const newRate = useCalcField();
  const newYears = useCalcField('30');
  const closingCosts = useCalcField();
  const [costHandling, setCostHandling] = useState<CostHandling>('payUpFront');

  const debtFilter = (type: string) => type === 'mortgage' || type === 'loan';
  const newTermMonths = monthsFromYears(newYears);
  const ready = balance.cents > 0 && remainingMonths.int > 0 && newTermMonths > 0 && newRate.filled;

  const input = useMemo(
    () => ({
      balanceCents: balance.cents,
      currentRateBps: currentRate.bps,
      currentRemainingMonths: remainingMonths.int,
      newRateBps: newRate.bps,
      newTermMonths,
      closingCostsCents: closingCosts.cents,
      rollCostsIntoLoan: costHandling === 'rollIn',
    }),
    [balance.cents, currentRate.bps, remainingMonths.int, newRate.bps, newTermMonths, closingCosts.cents, costHandling],
  );

  const result = useMemo(() => (ready ? compareRefinance(input) : null), [ready, input]);
  const keepPayingMonths = useMemo(() => (ready ? payoffMonthsAtCurrentPayment(input) : Infinity), [ready, input]);

  return (
    <CalcScreen>
      <Card title={t('financeTools.currentLoan')}>
        <LinkableNumberField
          label={t('financeTools.currentBalance')}
          quantity="balance"
          value={balance.text}
          onChangeText={balance.set}
          linkedAccountId={balance.linkedAccountId}
          onLink={balance.link}
          accountFilter={(a) => debtFilter(a.account.type)}
          placeholder={t('common.amountPlaceholder')}
        />
        <LinkableNumberField
          label={t('financeTools.currentRate')}
          quantity="rateBps"
          value={currentRate.text}
          onChangeText={currentRate.set}
          linkedAccountId={currentRate.linkedAccountId}
          onLink={currentRate.link}
          accountFilter={(a) => debtFilter(a.account.type)}
          placeholder="6.5"
        />
        <LinkableNumberField
          label={t('financeTools.remainingTermMonths')}
          quantity="remainingTermMonths"
          value={remainingMonths.text}
          onChangeText={remainingMonths.set}
          linkedAccountId={remainingMonths.linkedAccountId}
          onLink={remainingMonths.link}
          accountFilter={(a) => debtFilter(a.account.type)}
          keyboardType="number-pad"
          placeholder="300"
        />
      </Card>

      <Card title={t('financeTools.newLoan')}>
        <TextField
          label={t('financeTools.newRate')}
          value={newRate.text}
          onChangeText={newRate.set}
          keyboardType="decimal-pad"
          placeholder="5.5"
        />
        <TextField label={t('financeTools.newTermYears')} value={newYears.text} onChangeText={newYears.set} keyboardType="number-pad" />
        <TextField
          label={t('financeTools.closingCosts')}
          value={closingCosts.text}
          onChangeText={closingCosts.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <ChipRow
          value={costHandling}
          onChange={setCostHandling}
          options={[
            { value: 'payUpFront', label: t('financeTools.payCostsUpFront') },
            { value: 'rollIn', label: t('financeTools.rollCostsIn') },
          ]}
        />
      </Card>

      <ResultsCard ready={ready}>
        {result ? (
          <>
            <ResultRow
              label={t('financeTools.breakEven')}
              value={
                result.breakEvenMonths == null
                  ? t('financeTools.neverBreaksEven')
                  : result.breakEvenMonths === 0
                    ? t('financeTools.immediately')
                    : t('financeTools.monthsValue', { months: result.breakEvenMonths })
              }
              big
              tone={result.breakEvenMonths == null ? 'negative' : 'positive'}
              hint={result.breakEvenMonths ? t('financeTools.breakEvenOn', { date: addMonths(currentDateISO(), result.breakEvenMonths) }) : undefined}
            />
            <ResultRow
              label={t('financeTools.monthlySaving')}
              value={formatMoney(result.monthlySavingCents)}
              tone={result.monthlySavingCents > 0 ? 'positive' : 'negative'}
            />
            <ResultRow label={t('financeTools.currentPayment')} value={formatMoney(result.currentPaymentCents)} />
            <ResultRow label={t('financeTools.newPayment')} value={formatMoney(result.newPaymentCents)} />
            <ResultRow label={t('financeTools.newLoanAmount')} value={formatMoney(result.newLoanCents)} />
            <ResultRow label={t('financeTools.cashAtClosing')} value={formatMoney(result.cashAtClosingCents)} />
            <ResultRow
              label={t('financeTools.lifetimeInterestSaved')}
              value={formatMoney(result.lifetimeInterestSavedCents)}
              tone={result.lifetimeInterestSavedCents > 0 ? 'positive' : 'negative'}
              hint={t('financeTools.lifetimeInterestHint')}
            />
            {Number.isFinite(keepPayingMonths) ? (
              <ResultRow
                label={t('financeTools.keepPayingToday')}
                value={t('loanDetailsCard.payoffValue', {
                  date: addMonths(currentDateISO(), keepPayingMonths),
                  months: keepPayingMonths,
                })}
                hint={t('financeTools.keepPayingHint')}
              />
            ) : null}
            <AssumptionNote text={t('financeTools.refinanceNote')} />
          </>
        ) : null}
      </ResultsCard>
    </CalcScreen>
  );
}
