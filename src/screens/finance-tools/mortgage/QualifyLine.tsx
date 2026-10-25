import { StyleSheet, Text } from 'react-native';
import { text } from './parts';
import {
  GDS_LIMIT_PERCENT,
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

  if (q.gdsPercent == null || q.tdsPercent == null) {
    return (
      <Text style={text.hint}>
        {t('mortgagePlan.qualifyNeed', {
          income,
          rate,
          payment: formatMoney(q.stressPaymentCents),
        })}
      </Text>
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
    <Text style={[text.hint, passes ? styles.pass : text.warn]}>
      {passes
        ? t('mortgagePlan.qualifyYes')
        : t('mortgagePlan.qualifyNo', { income })}{' '}
      {ratios}
    </Text>
  );
}

const styles = StyleSheet.create({
  pass: { color: colors.positive },
});
