import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { ChipRow } from '../../components/ui/ChipRow';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { AssumptionNote, CalcScreen, ResultsCard } from './CalcScreen';
import { deductionSavingsCents, flatRateSavingsCents, marginalRateBpsAt, taxOnIncomeCents } from '../../finance-tools/taxSavings';
import type { TaxBracket } from '../../finance-tools/taxSavings';
import { formatMoney, parseMoneyToCents } from '../../domain/money';
import { useCalcField } from './useCalcField';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Basis = 'flatRate' | 'brackets';

interface BracketRow {
  upTo: string;
  rate: string;
}

const NEW_ROW: BracketRow = { upTo: '', rate: '' };

// Two ways to answer the same question, because two kinds of people ask it.
// Someone who knows their marginal rate wants one field; someone deciding how
// much to contribute needs the bracket table, since that's exactly when the
// flat-rate answer overstates the refund — a deduction that straddles a
// boundary doesn't come back at the top rate all the way down.
//
// No rates ship with the app for any country or year (see taxSavings.ts).
export function TaxSavingsScreen() {
  const t = useT();
  const [basis, setBasis] = useState<Basis>('flatRate');
  const deduction = useCalcField();
  const marginalRate = useCalcField();
  const taxableIncome = useCalcField();
  const [rows, setRows] = useState<BracketRow[]>([NEW_ROW, NEW_ROW, NEW_ROW]);

  const setRow = (index: number, patch: Partial<BracketRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const brackets: TaxBracket[] = useMemo(
    () =>
      rows
        .filter((row) => row.rate.trim() !== '')
        .map((row) => ({
          // An empty ceiling is the open-ended top band — the shape every
          // published table has, so it's the empty state rather than an
          // extra "is this the top bracket?" control.
          upToCents: row.upTo.trim() === '' ? null : parseMoneyToCents(row.upTo),
          rateBps: Math.round((Number.parseFloat(row.rate) || 0) * 100),
        })),
    [rows],
  );

  const ready = deduction.cents > 0 && (basis === 'flatRate' ? marginalRate.filled : brackets.length > 0 && taxableIncome.cents > 0);

  const flatSavingsCents = flatRateSavingsCents(deduction.cents, marginalRate.bps);
  const bracketSavingsCents = deductionSavingsCents(taxableIncome.cents, deduction.cents, brackets);
  const taxBeforeCents = taxOnIncomeCents(taxableIncome.cents, brackets);
  const taxAfterCents = taxOnIncomeCents(Math.max(0, taxableIncome.cents - deduction.cents), brackets);
  const marginalAtIncomeBps = marginalRateBpsAt(taxableIncome.cents, brackets);
  // What the one-field answer would have said — the gap is the whole reason
  // the bracket mode exists.
  const naiveSavingsCents = flatRateSavingsCents(deduction.cents, marginalAtIncomeBps);

  const savingsCents = basis === 'flatRate' ? flatSavingsCents : bracketSavingsCents;
  const effectivePercent = deduction.cents > 0 ? (savingsCents / deduction.cents) * 100 : 0;

  return (
    <CalcScreen>
      <Card title={t('financeTools.inputs')}>
        <TextField
          label={t('financeTools.deductionAmount')}
          value={deduction.text}
          onChangeText={deduction.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <ChipRow
          value={basis}
          onChange={setBasis}
          options={[
            { value: 'flatRate', label: t('financeTools.basisFlatRate') },
            { value: 'brackets', label: t('financeTools.basisBrackets') },
          ]}
        />
        {basis === 'flatRate' ? (
          <TextField
            label={t('financeTools.marginalRate')}
            value={marginalRate.text}
            onChangeText={marginalRate.set}
            keyboardType="decimal-pad"
            placeholder="30"
          />
        ) : (
          <TextField
            label={t('financeTools.taxableIncome')}
            value={taxableIncome.text}
            onChangeText={taxableIncome.set}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
          />
        )}
      </Card>

      {basis === 'brackets' ? (
        <Card title={t('financeTools.bracketTable')}>
          <Text style={styles.hint}>{t('financeTools.bracketHint')}</Text>
          {rows.map((row, i) => (
            <View key={i} style={styles.bracketRow}>
              <View style={styles.bracketCell}>
                <TextField
                  label={t('financeTools.bracketUpTo')}
                  value={row.upTo}
                  onChangeText={(text) => setRow(i, { upTo: text })}
                  keyboardType="decimal-pad"
                  placeholder={t('financeTools.bracketTopBand')}
                />
              </View>
              <View style={styles.bracketCell}>
                <TextField
                  label={t('financeTools.bracketRate')}
                  value={row.rate}
                  onChangeText={(text) => setRow(i, { rate: text })}
                  keyboardType="decimal-pad"
                  placeholder="15"
                />
              </View>
            </View>
          ))}
          <Pressable onPress={() => setRows((current) => [...current, NEW_ROW])}>
            <Text style={styles.addLink}>{t('financeTools.addBracket')}</Text>
          </Pressable>
        </Card>
      ) : null}

      <ResultsCard ready={ready}>
        <ResultRow
          label={t('financeTools.taxSaved')}
          value={formatMoney(savingsCents)}
          big
          tone="positive"
          hint={t('financeTools.effectiveDeductionRate', { percent: effectivePercent.toFixed(1) })}
        />
        <ResultRow label={t('financeTools.netCostOfContribution')} value={formatMoney(deduction.cents - savingsCents)} />
        {basis === 'brackets' ? (
          <>
            <ResultRow label={t('financeTools.taxBefore')} value={formatMoney(taxBeforeCents)} />
            <ResultRow label={t('financeTools.taxAfter')} value={formatMoney(taxAfterCents)} />
            <ResultRow label={t('financeTools.marginalRateAtIncome')} value={`${(marginalAtIncomeBps / 100).toFixed(2)}%`} />
            {naiveSavingsCents > bracketSavingsCents ? (
              <ResultRow
                label={t('financeTools.flatRateWouldSay')}
                value={formatMoney(naiveSavingsCents)}
                tone="muted"
                hint={t('financeTools.straddlesBracket')}
              />
            ) : null}
          </>
        ) : null}
        <AssumptionNote text={t('financeTools.taxNote')} />
      </ResultsCard>
    </CalcScreen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  bracketRow: { flexDirection: 'row', gap: spacing.sm },
  bracketCell: { flex: 1 },
  addLink: { color: colors.accent, fontWeight: '700', textAlign: 'center', paddingTop: spacing.sm },
});
