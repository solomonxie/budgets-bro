import { Text } from 'react-native';
import { ResultRow } from '../../../components/ui/ResultRow';
import { AssumptionNote } from '../CalcScreen';
import { SliderField, steps } from './SliderField';
import { text } from './parts';
import { DEFAULT_OTHER_CLOSING_CENTS } from './constants';
import type { PlanInputs } from './planInputs';
import {
  NO_TRANSFER_TAX_PROVINCES,
  TRANSFER_TAX_AS_OF,
} from '../../../finance-tools/canadianMortgage';
import type { PlanResult } from '../../../finance-tools/mortgagePlan';
import { formatMoney } from '../../../domain/money';
import { useT } from '../../../i18n';

const OTHER_CLOSING_STOPS = steps(0, 20_000, 250);

// Inside the loan box: the taxes hang on province and first-time buyer.
export function ClosingCosts({
  r,
  inputs,
}: {
  r: PlanResult;
  inputs: PlanInputs;
}) {
  const t = useT();
  const { closing } = r;
  return (
    <>
      <Text style={text.subheading}>
        {t('canadaPurchase.closingCostsHeading')}
      </Text>
      {NO_TRANSFER_TAX_PROVINCES.includes(inputs.province) ? (
        <ResultRow
          label={t('canadaPurchase.transferTax')}
          value={t('canadaPurchase.noTransferTax')}
          tone="muted"
        />
      ) : (
        <ResultRow
          label={t('canadaPurchase.transferTax')}
          value={formatMoney(closing.provincialTax.netCents)}
          hint={
            closing.provincialTax.rebateCents > 0
              ? t('canadaPurchase.rebateApplied', {
                  amount: formatMoney(closing.provincialTax.rebateCents),
                })
              : undefined
          }
        />
      )}
      {closing.municipalTax.taxCents > 0 ? (
        <ResultRow
          label={t('canadaPurchase.municipalTax')}
          value={formatMoney(closing.municipalTax.netCents)}
        />
      ) : null}
      {closing.premiumTaxCents > 0 ? (
        <ResultRow
          label={t('canadaPurchase.premiumTax')}
          value={formatMoney(closing.premiumTaxCents)}
          hint={t('canadaPurchase.premiumTaxHint')}
        />
      ) : null}
      <SliderField
        label={t('canadaPurchase.otherClosingCosts')}
        field={inputs.otherClosing}
        kind="money"
        stops={OTHER_CLOSING_STOPS}
        empty={DEFAULT_OTHER_CLOSING_CENTS / 100}
      />
      <ResultRow
        label={t('canadaPurchase.cashToClose')}
        value={formatMoney(closing.totalCents)}
        hint={t('canadaPurchase.cashToCloseHint')}
      />
      <AssumptionNote
        text={t('canadaPurchase.taxesAsOf', { date: TRANSFER_TAX_AS_OF })}
      />
    </>
  );
}
