import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { UnitAmountField } from '../../components/ui/UnitAmountField';
import { DropdownField, DropdownOption } from '../../components/ui/DropdownField';
import { AssumptionNote, CalcScreen, ResultsCard } from './CalcScreen';
import { useCalcField, monthsFromYears } from './useCalcField';
import {
  minimumDownPaymentCents,
  mortgageInsurance,
  paymentPlan,
  premiumSalesTaxCents,
  termSummary,
  transferTax,
  NO_TRANSFER_TAX_PROVINCES,
  TORONTO_RULES,
  TRANSFER_TAX_AS_OF,
  TRANSFER_TAX_RULES,
} from '../../finance-tools/canadianMortgage';
import type {
  Compounding,
  PaymentFrequency,
} from '../../finance-tools/canadianMortgage';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type DownUnit = 'percent' | 'amount';

const PROVINCES: { code: string; labelKey: TranslationKey }[] = [
  { code: 'BC', labelKey: 'province.BC' },
  { code: 'AB', labelKey: 'province.AB' },
  { code: 'SK', labelKey: 'province.SK' },
  { code: 'MB', labelKey: 'province.MB' },
  { code: 'ON', labelKey: 'province.ON' },
  { code: 'QC', labelKey: 'province.QC' },
  { code: 'NB', labelKey: 'province.NB' },
  { code: 'NS', labelKey: 'province.NS' },
  { code: 'PE', labelKey: 'province.PE' },
  { code: 'NL', labelKey: 'province.NL' },
];

const FREQUENCIES: { value: PaymentFrequency; labelKey: TranslationKey }[] = [
  { value: 'monthly', labelKey: 'frequency.monthly' },
  { value: 'semiMonthly', labelKey: 'frequency.semiMonthly' },
  { value: 'biweekly', labelKey: 'frequency.biweekly' },
  { value: 'acceleratedBiweekly', labelKey: 'frequency.acceleratedBiweekly' },
  { value: 'weekly', labelKey: 'frequency.weekly' },
  { value: 'acceleratedWeekly', labelKey: 'frequency.acceleratedWeekly' },
];

// Default legal + inspection + title, the three every purchase pays and
// nobody quotes until closing week. Editable; this is only a starting figure.
const DEFAULT_OTHER_CLOSING_CENTS = 250_000;

// The whole purchase, not just the mortgage: what it costs every month once
// the keys are yours, and what has to be in the account on closing day. The
// second number is the one that sinks a deal, and it is never on a listing.
export function CanadianPurchaseScreen() {
  const t = useT();
  const price = useCalcField();
  const down = useCalcField();
  const [downUnit, setDownUnit] = useState<DownUnit>('percent');
  const rate = useCalcField();
  const years = useCalcField('25');
  const termYears = useCalcField('5');
  const [frequency, setFrequency] = useState<PaymentFrequency>('monthly');
  const [compounding, setCompounding] = useState<Compounding>('semiAnnual');
  const [province, setProvince] = useState('BC');
  const [toronto, setToronto] = useState(false);
  const [firstTimeBuyer, setFirstTimeBuyer] = useState(false);

  const propertyTax = useCalcField();
  const condoFees = useCalcField();
  const heat = useCalcField();
  const otherExpenses = useCalcField();
  const rentalIncome = useCalcField();
  const otherClosing = useCalcField();

  const amortizationMonths = monthsFromYears(years);
  const ready = price.cents > 0 && amortizationMonths > 0;

  const downCents = useMemo(() => {
    if (downUnit === 'amount') return Math.min(down.cents, price.cents);
    return Math.round((price.cents * down.number) / 100);
  }, [downUnit, down.cents, down.number, price.cents]);

  const minimumCents = minimumDownPaymentCents(price.cents);
  const insurance = useMemo(
    () => mortgageInsurance(price.cents, downCents, amortizationMonths),
    [price.cents, downCents, amortizationMonths],
  );
  const plan = useMemo(
    () =>
      paymentPlan(
        insurance.totalMortgageCents,
        rate.bps,
        amortizationMonths,
        frequency,
        compounding,
      ),
    [insurance.totalMortgageCents, rate.bps, amortizationMonths, frequency, compounding],
  );
  const term = useMemo(
    () =>
      termSummary(
        insurance.totalMortgageCents,
        rate.bps,
        plan,
        Math.max(1, monthsFromYears(termYears)),
        compounding,
      ),
    [insurance.totalMortgageCents, rate.bps, plan, termYears, compounding],
  );

  // Every schedule is compared on the same footing: what it costs in a year,
  // spread over twelve. An accelerated payment is not cheaper per month —
  // that is the point of it.
  const monthlyPaymentCents = Math.round(plan.annualOutlayCents / 12);
  const monthlyTotalCents =
    monthlyPaymentCents +
    propertyTax.cents +
    condoFees.cents +
    heat.cents +
    otherExpenses.cents -
    rentalIncome.cents;

  const provincialTax = useMemo(() => {
    const rules = TRANSFER_TAX_RULES[province];
    return rules
      ? transferTax(price.cents, rules, firstTimeBuyer)
      : { taxCents: 0, rebateCents: 0, netCents: 0 };
  }, [province, price.cents, firstTimeBuyer]);
  const municipalTax = useMemo(
    () =>
      toronto && province === 'ON'
        ? transferTax(price.cents, TORONTO_RULES, firstTimeBuyer)
        : { taxCents: 0, rebateCents: 0, netCents: 0 },
    [toronto, province, price.cents, firstTimeBuyer],
  );
  const premiumTaxCents = premiumSalesTaxCents(insurance.premiumCents, province);
  const otherClosingCents = otherClosing.filled
    ? otherClosing.cents
    : DEFAULT_OTHER_CLOSING_CENTS;
  const cashToCloseCents =
    downCents +
    provincialTax.netCents +
    municipalTax.netCents +
    premiumTaxCents +
    otherClosingCents;

  const insuranceNote: TranslationKey | null =
    insurance.status === 'priceTooHigh'
      ? 'canadaPurchase.noteOverCeiling'
      : insurance.status === 'downTooSmall'
        ? 'canadaPurchase.noteBelowMinimum'
        : null;

  return (
    <CalcScreen>
      <Card title={t('financeTools.inputs')}>
        <TextField
          label={t('financeTools.homePrice')}
          value={price.text}
          onChangeText={price.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <UnitAmountField
          label={t('financeTools.downPayment')}
          value={down.text}
          onChangeText={down.set}
          unit={downUnit}
          onUnitChange={setDownUnit}
          units={[
            { value: 'percent', label: '%' },
            { value: 'amount', label: '$' },
          ]}
          placeholder={downUnit === 'percent' ? '20' : t('common.amountPlaceholder')}
        />
        {price.cents > 0 ? (
          <Pressable
            onPress={() => {
              setDownUnit('amount');
              down.set((minimumCents / 100).toFixed(0));
            }}
          >
            <Text style={styles.link}>
              {t('canadaPurchase.useMinimum', {
                amount: formatMoney(minimumCents),
              })}
            </Text>
          </Pressable>
        ) : null}
        <TextField
          label={t('calculators.interestRateLabel')}
          value={rate.text}
          onChangeText={rate.set}
          keyboardType="decimal-pad"
          placeholder="4.5"
        />
        <TextField
          label={t('canadaPurchase.amortizationYears')}
          value={years.text}
          onChangeText={years.set}
          keyboardType="number-pad"
        />
        <TextField
          label={t('canadaPurchase.termYears')}
          value={termYears.text}
          onChangeText={termYears.set}
          keyboardType="number-pad"
        />
        <DropdownField
          compact
          label={t('canadaPurchase.paymentFrequency')}
          valueLabel={t(
            FREQUENCIES.find((f) => f.value === frequency)!.labelKey,
          )}
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
          label={t('canadaPurchase.rateType')}
          valueLabel={t(
            compounding === 'semiAnnual'
              ? 'canadaPurchase.rateFixed'
              : 'canadaPurchase.rateVariable',
          )}
        >
          {(close) => (
            <>
              {(['semiAnnual', 'monthly'] as const).map((c) => (
                <DropdownOption
                  key={c}
                  label={t(
                    c === 'semiAnnual'
                      ? 'canadaPurchase.rateFixed'
                      : 'canadaPurchase.rateVariable',
                  )}
                  selected={compounding === c}
                  onPress={() => {
                    setCompounding(c);
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
          valueLabel={t(PROVINCES.find((p) => p.code === province)!.labelKey)}
        >
          {(close) => (
            <>
              {PROVINCES.map((p) => (
                <DropdownOption
                  key={p.code}
                  label={t(p.labelKey)}
                  selected={province === p.code}
                  onPress={() => {
                    setProvince(p.code);
                    close();
                  }}
                />
              ))}
            </>
          )}
        </DropdownField>
        <View style={styles.toggles}>
          <Toggle
            label={t('canadaPurchase.firstTimeBuyer')}
            on={firstTimeBuyer}
            onPress={() => setFirstTimeBuyer((v) => !v)}
          />
          {province === 'ON' ? (
            <Toggle
              label={t('canadaPurchase.toronto')}
              on={toronto}
              onPress={() => setToronto((v) => !v)}
            />
          ) : null}
        </View>
      </Card>

      <Card title={t('canadaPurchase.monthlyCostsHeading')}>
        <TextField
          label={t('canadaPurchase.propertyTaxMonthly')}
          value={propertyTax.text}
          onChangeText={propertyTax.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('canadaPurchase.condoFees')}
          value={condoFees.text}
          onChangeText={condoFees.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('canadaPurchase.heat')}
          value={heat.text}
          onChangeText={heat.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('canadaPurchase.otherExpenses')}
          value={otherExpenses.text}
          onChangeText={otherExpenses.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('canadaPurchase.rentalIncome')}
          value={rentalIncome.text}
          onChangeText={rentalIncome.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('canadaPurchase.otherClosingCosts')}
          value={otherClosing.text}
          onChangeText={otherClosing.set}
          keyboardType="decimal-pad"
          placeholder={(DEFAULT_OTHER_CLOSING_CENTS / 100).toFixed(0)}
        />
      </Card>

      <ResultsCard ready={ready}>
        <ResultRow
          label={t('canadaPurchase.totalMonthlyCost')}
          value={formatMoney(monthlyTotalCents)}
          big
        />
        <ResultRow
          label={t('canadaPurchase.paymentEach', {
            frequency: t(FREQUENCIES.find((f) => f.value === frequency)!.labelKey),
          })}
          value={formatMoney(plan.paymentCents)}
        />
        {frequency !== 'monthly' ? (
          <ResultRow
            label={t('canadaPurchase.paymentPerMonthEquivalent')}
            value={formatMoney(monthlyPaymentCents)}
            tone="muted"
          />
        ) : null}
        <ResultRow
          label={t('canadaPurchase.mortgageAmount')}
          value={formatMoney(insurance.totalMortgageCents)}
        />
        {insurance.status === 'insured' ? (
          <ResultRow
            label={t('canadaPurchase.insurancePremium', {
              rate: (insurance.premiumRateBps / 100).toFixed(2),
            })}
            value={formatMoney(insurance.premiumCents)}
            tone="negative"
            hint={t('canadaPurchase.premiumFinancedHint')}
          />
        ) : null}
        <ResultRow
          label={t('canadaPurchase.loanToValue')}
          value={`${(insurance.ltvBps / 100).toFixed(1)}%`}
          tone="muted"
        />
        {Number.isFinite(plan.monthsToPayoff) ? (
          <ResultRow
            label={t('canadaPurchase.payoffIn')}
            value={t('canadaPurchase.yearsMonths', {
              years: Math.floor(plan.monthsToPayoff / 12),
              months: plan.monthsToPayoff % 12,
            })}
            tone={plan.monthsToPayoff < amortizationMonths ? 'positive' : 'default'}
          />
        ) : null}
        <ResultRow
          label={t('canadaPurchase.totalInterest')}
          value={formatMoney(plan.totalInterestCents)}
          tone="negative"
        />
        {insuranceNote ? <AssumptionNote text={t(insuranceNote)} /> : null}
      </ResultsCard>

      <Card
        title={t('canadaPurchase.termHeading', {
          years: Math.max(1, termYears.int),
        })}
      >
        <ResultRow
          label={t('canadaPurchase.termInterest')}
          value={formatMoney(term.interestPaidCents)}
          tone="negative"
        />
        <ResultRow
          label={t('canadaPurchase.termPrincipal')}
          value={formatMoney(term.principalPaidCents)}
        />
        <ResultRow
          label={t('canadaPurchase.termBalance')}
          value={formatMoney(term.balanceCents)}
          big
        />
        <AssumptionNote text={t('canadaPurchase.termNote')} />
      </Card>

      <Card title={t('canadaPurchase.cashToCloseHeading')}>
        <ResultRow
          label={t('canadaPurchase.cashToClose')}
          value={formatMoney(cashToCloseCents)}
          big
        />
        <ResultRow
          label={t('financeTools.downPayment')}
          value={formatMoney(downCents)}
        />
        {NO_TRANSFER_TAX_PROVINCES.includes(province) ? (
          <ResultRow
            label={t('canadaPurchase.transferTax')}
            value={t('canadaPurchase.noTransferTax')}
            tone="muted"
          />
        ) : (
          <ResultRow
            label={t('canadaPurchase.transferTax')}
            value={formatMoney(provincialTax.netCents)}
            hint={
              provincialTax.rebateCents > 0
                ? t('canadaPurchase.rebateApplied', {
                    amount: formatMoney(provincialTax.rebateCents),
                  })
                : undefined
            }
          />
        )}
        {municipalTax.taxCents > 0 ? (
          <ResultRow
            label={t('canadaPurchase.municipalTax')}
            value={formatMoney(municipalTax.netCents)}
          />
        ) : null}
        {premiumTaxCents > 0 ? (
          <ResultRow
            label={t('canadaPurchase.premiumTax')}
            value={formatMoney(premiumTaxCents)}
            hint={t('canadaPurchase.premiumTaxHint')}
          />
        ) : null}
        <ResultRow
          label={t('canadaPurchase.otherClosingCosts')}
          value={formatMoney(otherClosingCents)}
          tone="muted"
        />
        <AssumptionNote
          text={t('canadaPurchase.taxesAsOf', { date: TRANSFER_TAX_AS_OF })}
        />
      </Card>
    </CalcScreen>
  );
}

function Toggle({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.toggle, on && styles.toggleOn]}
      onPress={onPress}
    >
      <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 13, fontWeight: '700', color: colors.accent },
  toggles: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  toggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  toggleOn: { borderColor: colors.accent, backgroundColor: colors.surface },
  toggleText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  toggleTextOn: { color: colors.accent },
});
