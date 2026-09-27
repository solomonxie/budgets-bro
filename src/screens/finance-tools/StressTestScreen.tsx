import { useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import type { ResultTone } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { LinkableNumberField } from '../../components/ui/LinkableNumberField';
import { AssumptionNote, CalcScreen, ResultsCard } from './CalcScreen';
import { useCalcField } from './useCalcField';
import {
  MORTGAGE_RULE,
  rateShocks,
  repricedPayment,
  stressTest,
} from '../../finance-tools/debtHealth';
import type { DebtHealthLevel, RepricedPayment } from '../../finance-tools/debtHealth';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';

const TONE: Record<DebtHealthLevel, ResultTone> = {
  healthy: 'positive',
  stretched: 'default',
  atRisk: 'negative',
};

// What the mortgage asks of take-home pay today, at the stress-test rate, and
// at renewals 1–3 points higher.
export function StressTestScreen() {
  const t = useT();
  const balance = useCalcField();
  const rate = useCalcField();
  const remainingMonths = useCalcField();
  const income = useCalcField();

  const isMortgage = (type: string) => type === 'mortgage';
  const ready =
    balance.cents > 0 && rate.filled && remainingMonths.int > 0 && income.cents > 0;

  const result = useMemo(() => {
    if (!ready) return null;
    const loan = {
      owedCents: balance.cents,
      rateBps: rate.bps,
      remainingMonths: remainingMonths.int,
      monthlyIncomeCents: income.cents,
    };
    return {
      now: repricedPayment(loan, rate.bps, MORTGAGE_RULE),
      stress: stressTest(loan, MORTGAGE_RULE),
      shocks: rateShocks(loan, MORTGAGE_RULE),
    };
  }, [ready, balance.cents, rate.bps, remainingMonths.int, income.cents]);

  const row = (label: string, r: RepricedPayment | null, big = false) =>
    r ? (
      <ResultRow
        key={label}
        label={label}
        value={`${formatMoney(r.paymentCents)} · ${r.percent!.toFixed(1)}%`}
        tone={TONE[r.level!]}
        big={big}
      />
    ) : null;

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
          accountFilter={(a) => isMortgage(a.account.type)}
          placeholder={t('common.amountPlaceholder')}
        />
        <LinkableNumberField
          label={t('financeTools.currentRate')}
          quantity="rateBps"
          value={rate.text}
          onChangeText={rate.set}
          linkedAccountId={rate.linkedAccountId}
          onLink={rate.link}
          accountFilter={(a) => isMortgage(a.account.type)}
          placeholder="4.5"
        />
        <LinkableNumberField
          label={t('financeTools.remainingTermMonths')}
          quantity="remainingTermMonths"
          value={remainingMonths.text}
          onChangeText={remainingMonths.set}
          linkedAccountId={remainingMonths.linkedAccountId}
          onLink={remainingMonths.link}
          accountFilter={(a) => isMortgage(a.account.type)}
          keyboardType="number-pad"
          placeholder="300"
        />
        <TextField
          label={t('calcStressTest.takeHome')}
          value={income.text}
          onChangeText={income.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
      </Card>

      <ResultsCard ready={ready}>
        {result ? (
          <>
            {row(
              t('calcStressTest.stressPayment', {
                rate: ((result.stress?.rateBps ?? 0) / 100).toFixed(2),
              }),
              result.stress,
              true,
            )}
            {row(t('calcStressTest.todayPayment'), result.now)}
            {result.shocks.map((s) =>
              row(
                t('debtHealth.rateShock', {
                  add: (s.rateBps - rate.bps) / 100,
                  rate: (s.rateBps / 100).toFixed(2),
                }),
                s,
              ),
            )}
            <AssumptionNote
              text={t('calcStressTest.note', {
                healthy: MORTGAGE_RULE.healthyMaxPercent,
                stretched: MORTGAGE_RULE.stretchedMaxPercent,
              })}
            />
          </>
        ) : null}
      </ResultsCard>
    </CalcScreen>
  );
}
