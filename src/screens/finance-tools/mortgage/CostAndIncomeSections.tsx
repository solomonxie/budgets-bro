import { Text } from 'react-native';
import { SliderField, steps } from './SliderField';
import { Section, text } from './parts';
import type { PlanInputs } from './planInputs';
import type { PlanResult } from '../../../finance-tools/mortgagePlan';
import { formatMoney } from '../../../domain/money';
import { useT } from '../../../i18n';

const PROPERTY_TAX_STOPS = steps(0, 2, 0.05);
const CONDO_STOPS = steps(0, 1500, 25);
const HEAT_STOPS = steps(0, 400, 10);
const OTHER_STOPS = steps(0, 2000, 25);
const RENTAL_STOPS = steps(0, 5000, 50);
const DEBT_STOPS = steps(0, 5000, 50);
const INCOME_STOPS = [
  ...steps(0, 300_000, 5_000),
  ...steps(325_000, 1_000_000, 25_000),
];

export function MonthlyCostsSection({
  r,
  inputs,
  homeValueCents,
  defaultOpen,
}: {
  r: PlanResult;
  inputs: PlanInputs;
  homeValueCents: number;
  defaultOpen: boolean;
}) {
  const t = useT();
  const { propertyTaxRate, condoFees, heat, otherExpenses, rentalIncome } =
    inputs;
  return (
    <Section
      title={t('canadaPurchase.monthlyCostsHeading')}
      summary={
        r.ready
          ? t('common.perMonth', {
              amount: formatMoney(r.monthlyTotalCents - r.monthlyPaymentCents),
            })
          : ''
      }
      defaultOpen={defaultOpen}
    >
      <SliderField
        label={t('canadaPurchase.propertyTaxRate')}
        field={propertyTaxRate}
        kind="percent"
        stops={PROPERTY_TAX_STOPS}
        empty={0.7}
        hint={
          r.propertyTaxMonthlyCents > 0
            ? t('canadaPurchase.propertyTaxHintPrice', {
                amount: formatMoney(r.propertyTaxMonthlyCents),
              })
            : t('canadaPurchase.propertyTaxHint')
        }
      />
      <SliderField
        label={t('mortgagePlan.condoShort')}
        field={condoFees}
        kind="money"
        stops={CONDO_STOPS}
      />
      <SliderField
        label={t('mortgagePlan.heatShort')}
        field={heat}
        kind="money"
        stops={HEAT_STOPS}
        empty={100}
      />
      <Text style={text.hint}>{t('mortgagePlan.condoHeatHint')}</Text>
      <SliderField
        label={t('mortgagePlan.otherShort')}
        field={otherExpenses}
        kind="money"
        stops={OTHER_STOPS}
        empty={
          homeValueCents > 0
            ? Math.round((homeValueCents * 0.01) / 12 / 100)
            : 0
        }
      />
      <SliderField
        label={t('mortgagePlan.rentalShort')}
        field={rentalIncome}
        kind="money"
        stops={RENTAL_STOPS}
      />
      <Text style={text.hint}>{t('mortgagePlan.otherRentalHint')}</Text>
    </Section>
  );
}

export function IncomeSection({
  inputs,
  defaultOpen,
}: {
  inputs: PlanInputs;
  defaultOpen: boolean;
}) {
  const t = useT();
  const { income, otherDebts } = inputs;
  return (
    <Section
      title={t('mortgagePlan.youHeading')}
      summary={income.cents > 0 ? formatMoney(income.cents) : ''}
      defaultOpen={defaultOpen}
    >
      <SliderField
        label={t('mortgagePlan.incomeShort')}
        field={income}
        kind="money"
        stops={INCOME_STOPS}
        empty={150_000}
      />
      <SliderField
        label={t('mortgagePlan.debtsShort')}
        field={otherDebts}
        kind="money"
        stops={DEBT_STOPS}
      />
      <Text style={text.hint}>{t('mortgagePlan.youHint')}</Text>
    </Section>
  );
}
