import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  addMonths,
  monthlyPaymentCents,
  remainingMonthsToPayoff,
  totalInterestRemainingCents,
} from '../../finance-tools/amortization';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { AccountsStackParamList } from '../../navigation/types';
import type { Account } from '../../domain/types';

type Nav = NativeStackNavigationProp<AccountsStackParamList, 'AccountDetail'>;

// Full-context amortization projection for a loan/mortgage account: its
// stored terms plus the ledger's *actual* current balance, so extra
// payments already made show up as a shorter projected payoff.
export function LoanDetailsCard({ account, balanceCents }: { account: Account; balanceCents: number }) {
  const navigation = useNavigation<Nav>();

  if (account.interestRateBps == null || account.termMonths == null || account.originalPrincipalCents == null) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Loan Details</Text>
        <Text style={styles.hint}>Add the interest rate, term, and original principal to see a payoff projection.</Text>
        <Pressable onPress={() => navigation.navigate('AccountForm', { accountId: account.id })}>
          <Text style={styles.link}>Add Loan Terms</Text>
        </Pressable>
      </View>
    );
  }

  const outstandingCents = Math.max(0, -balanceCents);
  const scheduledPaymentCents = monthlyPaymentCents(account.originalPrincipalCents, account.interestRateBps, account.termMonths);
  const remainingMonths = remainingMonthsToPayoff(outstandingCents, account.interestRateBps, scheduledPaymentCents);
  const remainingInterestCents = totalInterestRemainingCents(outstandingCents, scheduledPaymentCents, remainingMonths);
  const payoffDate = Number.isFinite(remainingMonths) ? addMonths(currentDateISO(), remainingMonths) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Loan Details</Text>
      <Row label="Rate" value={`${(account.interestRateBps / 100).toFixed(2)}%`} />
      <Row label="Scheduled payment" value={`${formatMoney(scheduledPaymentCents)}/mo`} />
      <Row
        label="Projected payoff"
        value={payoffDate ? `${payoffDate} (${remainingMonths} mo)` : 'Payment too low to pay off'}
      />
      <Row label="Est. remaining interest" value={Number.isFinite(remainingInterestCents) ? formatMoney(remainingInterestCents) : '—'} />
      <Pressable onPress={() => navigation.navigate('AccountForm', { accountId: account.id })}>
        <Text style={styles.link}>Edit Loan Terms</Text>
      </Pressable>
    </View>
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
    gap: spacing.xs,
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.text },
});
