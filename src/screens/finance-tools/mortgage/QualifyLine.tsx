import { StyleSheet, Text } from 'react-native';
import { AssumptionNote } from '../CalcScreen';
import { text } from './parts';
import {
  GDS_LIMIT_PERCENT,
  LENDER_HEAT_CENTS,
  LENDER_PROPERTY_TAX_BPS,
  TDS_LIMIT_PERCENT,
} from '../../../finance-tools/canadianMortgage';
import type { PlanResult } from '../../../finance-tools/mortgagePlan';
import { formatMoney, formatPercent } from '../../../domain/money';
import { useT } from '../../../i18n';
import { colors } from '../../../theme/colors';

export function QualifyLine({ r }: { r: PlanResult }) {
  const t = useT();
  const q = r.qualifying;
  const rate = formatPercent(q.stressRateBps);
  const income = formatMoney(q.required.requiredAnnualCents);
  // Only what the figures above actually lean on.
  const assumed = [
    q.assumedHeat
      ? t('mortgagePlan.assumedHeat', { amount: formatMoney(LENDER_HEAT_CENTS) })
      : null,
    q.assumedPropertyTax
      ? t('mortgagePlan.assumedTax', {
          rate: formatPercent(LENDER_PROPERTY_TAX_BPS),
        })
      : null,
    q.rentalCountedCents > 0
      ? t('mortgagePlan.rentalCounted', {
          amount: formatMoney(q.rentalCountedCents),
        })
      : null,
  ].filter(Boolean);
  const note =
    assumed.length > 0 ? <AssumptionNote text={assumed.join(' ')} /> : null;

  if (q.gdsPercent == null || q.tdsPercent == null) {
    return (
      <>
        <Text style={text.hint}>
          {t('mortgagePlan.qualifyNeed', {
            income,
            rate,
            payment: formatMoney(q.stressPaymentCents),
          })}
        </Text>
        {note}
      </>
    );
  }
  const passes =
    q.gdsPercent <= GDS_LIMIT_PERCENT && q.tdsPercent <= TDS_LIMIT_PERCENT;
  const ratios = t('mortgagePlan.qualifyRatios', {
    gds: q.gdsPercent.toFixed(0),
    gdsLimit: GDS_LIMIT_PERCENT,
    tds: q.tdsPercent.toFixed(0),
    tdsLimit: TDS_LIMIT_PERCENT,
    rate,
  });
  return (
    <>
      <Text style={[text.hint, passes ? styles.pass : text.warn]}>
        {passes
          ? t('mortgagePlan.qualifyYes')
          : t('mortgagePlan.qualifyNo', { income })}{' '}
        {ratios}
      </Text>
      {note}
    </>
  );
}

const styles = StyleSheet.create({
  pass: { color: colors.positive },
});
