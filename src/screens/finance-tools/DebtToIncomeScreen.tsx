import { useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { AssumptionNote, CalcScreen, ResultsCard } from './CalcScreen';
import { useCalcField } from './useCalcField';
import { CONVENTIONAL_28_36, dtiRatios } from '../../finance-tools/affordability';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';

// The one number a lender decides on. Worth its own screen because the useful
// output isn't the ratio, it's the headroom: how much more debt fits before
// the answer turns into no.
export function DebtToIncomeScreen() {
  const t = useT();
  const monthlyIncome = useCalcField();
  const housing = useCalcField();
  const otherDebt = useCalcField();

  const ready = monthlyIncome.cents > 0;
  const ratios = useMemo(
    () =>
      dtiRatios({
        monthlyIncomeCents: monthlyIncome.cents,
        housingCents: housing.cents,
        otherDebtCents: otherDebt.cents,
      }),
    [monthlyIncome.cents, housing.cents, otherDebt.cents],
  );

  const backCapCents = Math.round((monthlyIncome.cents * CONVENTIONAL_28_36.backEndPercent) / 100);
  const headroomCents = backCapCents - housing.cents - otherDebt.cents;
  const tone = ratios.backEndPercent <= CONVENTIONAL_28_36.backEndPercent ? 'positive' : ratios.backEndPercent <= 43 ? 'default' : 'negative';

  return (
    <CalcScreen>
      <Card title={t('financeTools.inputs')}>
        <TextField
          label={t('financeTools.grossMonthlyIncome')}
          value={monthlyIncome.text}
          onChangeText={monthlyIncome.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('financeTools.housingPayment')}
          value={housing.text}
          onChangeText={housing.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('financeTools.otherDebtPayments')}
          value={otherDebt.text}
          onChangeText={otherDebt.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
      </Card>

      <ResultsCard ready={ready}>
        <ResultRow
          label={t('financeTools.backEndRatio')}
          value={`${ratios.backEndPercent.toFixed(1)}%`}
          big
          tone={tone}
          hint={t('financeTools.backEndHint')}
        />
        <ResultRow
          label={t('financeTools.frontEndRatio')}
          value={`${ratios.frontEndPercent.toFixed(1)}%`}
          tone={ratios.frontEndPercent <= CONVENTIONAL_28_36.frontEndPercent ? 'positive' : 'negative'}
          hint={t('financeTools.frontEndHint')}
        />
        <ResultRow
          label={t('financeTools.roomForMoreDebt')}
          value={formatMoney(Math.max(0, headroomCents))}
          tone={headroomCents > 0 ? 'positive' : 'negative'}
          hint={headroomCents <= 0 ? t('financeTools.overTheCap') : undefined}
        />
        <AssumptionNote text={t('financeTools.dtiNote')} />
      </ResultsCard>
    </CalcScreen>
  );
}
