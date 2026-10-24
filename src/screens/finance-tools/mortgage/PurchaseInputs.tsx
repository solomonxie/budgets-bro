import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  DropdownField,
  DropdownOption,
} from '../../../components/ui/DropdownField';
import type { CalcField } from '../useCalcField';
import { SliderField, steps } from './SliderField';
import {
  Chips,
  Section,
  Toggle,
  YearChoice,
  text,
  toggleRow,
  withThousands,
} from './parts';
import { RATE_STOPS, TERM_YEARS } from './constants';
import type { PlanInputs } from './planInputs';
import { maxAmortizationMonths } from '../../../finance-tools/mortgagePlan';
import type { PlanResult } from '../../../finance-tools/mortgagePlan';
import type {
  Compounding,
  PaymentFrequency,
} from '../../../finance-tools/canadianMortgage';
import { formatMoney, formatPercent } from '../../../domain/money';
import { useT } from '../../../i18n';
import type { TranslationKey } from '../../../i18n';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

const PROVINCES = [
  'BC',
  'AB',
  'SK',
  'MB',
  'ON',
  'QC',
  'NB',
  'NS',
  'PE',
  'NL',
] as const;

export const FREQUENCIES: {
  value: PaymentFrequency;
  labelKey: TranslationKey;
}[] = [
  { value: 'monthly', labelKey: 'frequency.monthly' },
  { value: 'semiMonthly', labelKey: 'frequency.semiMonthly' },
  { value: 'biweekly', labelKey: 'frequency.biweekly' },
  { value: 'acceleratedBiweekly', labelKey: 'frequency.acceleratedBiweekly' },
  { value: 'weekly', labelKey: 'frequency.weekly' },
  { value: 'acceleratedWeekly', labelKey: 'frequency.acceleratedWeekly' },
];

const DOWN_STOPS = steps(5, 50, 1);
const AMORTIZATION_YEARS = [15, 20, 25, 30];

// The home and the loan: price up top, then the loan's terms, folded to one
// line once filled.
export function PurchaseInputs({
  inputs,
  r,
  defaultOpen,
}: {
  inputs: PlanInputs;
  r: PlanResult;
  defaultOpen: boolean;
}) {
  const t = useT();
  const {
    price,
    down,
    downUnit,
    setDownUnit,
    rate,
    years,
    termYears,
    frequency,
    setFrequency,
    compounding,
    setCompounding,
    province,
    setProvince,
    firstTime,
    setFirstTime,
    toronto,
    setToronto,
  } = inputs;

  // The slider works in percent; an amount typed earlier (or "use the
  // minimum") is shown as the percent it comes to.
  const downPercentNumber =
    downUnit === 'percent'
      ? down.number
      : price.cents > 0
        ? Number(((down.cents / price.cents) * 100).toFixed(1))
        : 0;
  const downPercent: CalcField = {
    ...down,
    text: downUnit === 'percent' ? down.text : String(downPercentNumber),
    number: downPercentNumber,
    set: (next) => {
      setDownUnit('percent');
      down.set(next);
    },
  };

  const loanSummary = [
    down.filled
      ? t('mortgagePlan.foldDownPercent', { percent: downPercent.number })
      : null,
    rate.filled ? formatPercent(rate.bps) : null,
    years.int > 0 ? t('mortgagePlan.foldYears', { years: years.int }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const insured = r.insurance.status === 'insured';
  const amortizationCap = maxAmortizationMonths(insured, firstTime === '1');
  const overAmortization =
    r.ready && Math.round(years.number * 12) > amortizationCap;
  const belowMinimumDown = price.cents > 0 && r.downCents < r.minimumDownCents;
  const overQualifying =
    r.qualifying.maxPriceCents != null &&
    price.cents > r.qualifying.maxPriceCents;
  const freqLabel = t(FREQUENCIES.find((f) => f.value === frequency)!.labelKey);

  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{t('financeTools.homePrice')}</Text>
        <View style={styles.heroRow}>
          <Text style={styles.heroSymbol}>$</Text>
          <TextInput
            style={styles.heroInput}
            value={withThousands(price.text)}
            onChangeText={(next) => price.set(withThousands(next))}
            keyboardType="number-pad"
            keyboardAppearance="dark"
            placeholder="800,000"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <SliderField
          label=""
          field={price}
          kind="money"
          around={10_000}
          empty={800_000}
        />
        {overQualifying ? (
          <Text style={text.warn}>
            {t('mortgagePlan.overQualifying', {
              amount: formatMoney(r.qualifying.maxPriceCents!),
            })}
          </Text>
        ) : null}
      </View>

      <Section
        title={t('mortgagePlan.loanHeading')}
        summary={loanSummary}
        defaultOpen={defaultOpen}
      >
        <SliderField
          label={t('financeTools.downPayment')}
          field={downPercent}
          kind="percent"
          stops={DOWN_STOPS}
          empty={20}
          display={
            down.filled && price.cents > 0
              ? `${downPercent.text}% · ${formatMoney(r.downCents)}`
              : undefined
          }
        />
        {price.cents > 0 ? (
          <Text style={[text.hint, belowMinimumDown && text.warn]}>
            <Text
              style={text.link}
              onPress={() => {
                setDownUnit('amount');
                down.set(
                  withThousands(String(Math.round(r.minimumDownCents / 100))),
                );
              }}
            >
              {t('canadaPurchase.useMinimum', {
                amount: formatMoney(r.minimumDownCents),
              })}
            </Text>
          </Text>
        ) : null}
        <SliderField
          label={t('calculators.interestRateLabel')}
          field={rate}
          kind="percent"
          stops={RATE_STOPS}
          empty={4.5}
        />
        <YearChoice
          label={t('calcAmortization.title')}
          field={years}
          years={AMORTIZATION_YEARS}
        />
        <YearChoice
          label={t('mortgagePlan.termShort')}
          field={termYears}
          years={TERM_YEARS}
        />
        {overAmortization ? (
          <Text style={text.warn}>
            {t(
              insured
                ? 'mortgagePlan.amortizationInsured'
                : 'mortgagePlan.amortizationMax',
              { years: amortizationCap / 12 },
            )}
          </Text>
        ) : null}
        <Chips
          options={[
            { value: 'semiAnnual', label: t('canadaPurchase.rateFixed') },
            { value: 'monthly', label: t('canadaPurchase.rateVariable') },
          ]}
          value={compounding}
          onChange={(v) => setCompounding(v as Compounding)}
        />
        <DropdownField
          compact
          label={t('canadaPurchase.paymentFrequency')}
          valueLabel={freqLabel}
        >
          {(close) => (
            <>
              {FREQUENCIES.map((f) => (
                <DropdownOption
                  key={f.value}
                  label={t(f.labelKey)}
                  selected={frequency === f.value}
                  onPress={() => {
                    setFrequency(f.value);
                    close();
                  }}
                />
              ))}
            </>
          )}
        </DropdownField>
        <DropdownField
          compact
          label={t('canadaPurchase.province')}
          valueLabel={t(`province.${province}` as TranslationKey)}
        >
          {(close) => (
            <>
              {PROVINCES.map((p) => (
                <DropdownOption
                  key={p}
                  label={t(`province.${p}` as TranslationKey)}
                  selected={province === p}
                  onPress={() => {
                    setProvince(p);
                    close();
                  }}
                />
              ))}
            </>
          )}
        </DropdownField>
        <View style={toggleRow.row}>
          <Toggle
            label={t('canadaPurchase.firstTimeBuyer')}
            on={firstTime === '1'}
            onPress={() => setFirstTime(firstTime === '1' ? '0' : '1')}
          />
          {province === 'ON' ? (
            <Toggle
              label={t('canadaPurchase.toronto')}
              on={toronto === '1'}
              onPress={() => setToronto(toronto === '1' ? '0' : '1')}
            />
          ) : null}
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.xs,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroSymbol: { fontSize: 32, fontWeight: '700', color: colors.textMuted },
  heroInput: {
    flex: 1,
    fontSize: 34,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: spacing.xs,
  },
});
