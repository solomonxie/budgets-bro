import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { getDb } from '../../db/client';
import * as reportsRepo from '../../db/repositories/reportsRepo';
import { useAppStore } from '../../state/useAppStore';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

function toCents(text: string): number {
  const parsed = parseFloat(text);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

// Rough, local-only estimate from this year's ledger plus two manual
// inputs — not tax advice, and no filing-status/bracket logic yet.
export function TaxInsightsScreen() {
  const t = useT();
  const month = useAppStore((s) => s.currentMonth);
  const boardId = useAppStore((s) => s.currentBoardId);
  const year = month.slice(0, 4);
  const [ledgerTotals, setLedgerTotals] = useState({ incomeCents: 0, spendingCents: 0 });
  const [additionalIncome, setAdditionalIncome] = useState('');
  const [deductions, setDeductions] = useState('');

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const totals = await reportsRepo.incomeAndSpendingInRange(db, boardId, `${year}-01-01`, `${Number(year) + 1}-01-01`);
      setLedgerTotals(totals);
    })();
  }, [year, boardId]);

  const estimatedTaxableIncomeCents = ledgerTotals.incomeCents + toCents(additionalIncome) - toCents(deductions);

  return (
    <ScreenContainer scroll>
      <View style={styles.card}>
        <Text style={styles.title}>{t('taxInsights.title', { year })}</Text>
        <Text style={styles.disclaimer}>{t('taxInsights.disclaimer')}</Text>
      </View>

      <View style={styles.card}>
        <Row label={t('taxInsights.ledgerIncomeLabel', { year })} value={formatMoney(ledgerTotals.incomeCents)} />
        <Row label={t('taxInsights.ledgerSpendingLabel', { year })} value={formatMoney(ledgerTotals.spendingCents)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('taxInsights.additionalInfoLabel')}</Text>
        <TextField
          label={t('taxInsights.additionalIncomeLabel')}
          placeholder={t('common.amountPlaceholder')}
          keyboardType="decimal-pad"
          value={additionalIncome}
          onChangeText={setAdditionalIncome}
        />
        <TextField
          label={t('taxInsights.deductionsLabel')}
          placeholder={t('common.amountPlaceholder')}
          keyboardType="decimal-pad"
          value={deductions}
          onChangeText={setDeductions}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('taxInsights.estimatedTaxableIncomeLabel')}</Text>
        <Text style={styles.value}>{formatMoney(estimatedTaxableIncomeCents)}</Text>
      </View>

      <Pressable
        style={styles.aiButton}
        onPress={() => Alert.alert(t('taxInsights.aiSummaryTitle'), t('taxInsights.aiSummaryMessage'))}
      >
        <Text style={styles.aiButtonText}>{t('taxInsights.askAi')}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  disclaimer: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  value: { fontSize: 26, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: colors.text },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  aiButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    borderStyle: 'dashed',
    marginBottom: 80,
  },
  aiButtonText: { color: colors.accent, fontWeight: '700' },
});
