import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Chip } from '../../components/ui/Chip';
import { TextField } from '../../components/ui/TextField';
import { getDb } from '../../db/client';
import * as accountsRepo from '../../db/repositories/accountsRepo';
import { useAppStore } from '../../state/useAppStore';
import { isLoanLikeType } from '../../domain/accountKind';
import { currentDateISO } from '../../domain/month';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { AccountsStackParamList } from '../../navigation/types';
import type { AccountType } from '../../domain/types';

type Nav = NativeStackNavigationProp<AccountsStackParamList, 'AccountForm'>;
type Route = RouteProp<AccountsStackParamList, 'AccountForm'>;

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
  { value: 'income', label: 'Income Source' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'tracking', label: 'Tracking' },
];

export function AccountFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const accountId = route.params?.accountId;
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [originalPrincipal, setOriginalPrincipal] = useState('');
  const [originationDate, setOriginationDate] = useState(currentDateISO());

  useEffect(() => {
    if (accountId == null) return;
    (async () => {
      const db = await getDb();
      const account = await accountsRepo.getAccount(db, accountId);
      if (account) {
        setName(account.name);
        setType(account.type);
        setOpeningBalance((account.openingBalanceCents / 100).toString());
        if (account.interestRateBps != null) setInterestRate((account.interestRateBps / 100).toString());
        if (account.termMonths != null) setTermMonths(String(account.termMonths));
        if (account.originalPrincipalCents != null) setOriginalPrincipal((account.originalPrincipalCents / 100).toString());
        if (account.originationDate) setOriginationDate(account.originationDate);
      }
    })();
  }, [accountId]);

  const isLoanLike = isLoanLikeType(type);

  const save = async () => {
    if (!name.trim()) return;
    const db = await getDb();
    const openingBalanceCents = Math.round(parseFloat(openingBalance || '0') * 100);
    const input = {
      name: name.trim(),
      type,
      openingBalanceCents,
      interestRateBps: isLoanLike && interestRate ? Math.round(parseFloat(interestRate) * 100) : null,
      termMonths: isLoanLike && termMonths ? Math.round(parseFloat(termMonths)) : null,
      originalPrincipalCents: isLoanLike && originalPrincipal ? Math.round(parseFloat(originalPrincipal) * 100) : null,
      originationDate: isLoanLike ? originationDate : null,
    };
    if (accountId != null) {
      await accountsRepo.updateAccount(db, accountId, input);
    } else {
      await accountsRepo.createAccount(db, input);
    }
    bumpDataVersion();
    navigation.goBack();
  };

  return (
    <ScreenContainer scroll>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Checking" />
      <View style={styles.field}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.chipRow}>
          {TYPE_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} selected={type === opt.value} onPress={() => setType(opt.value)} />
          ))}
        </View>
      </View>
      <TextField
        label="Opening Balance"
        value={openingBalance}
        onChangeText={setOpeningBalance}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      {isLoanLike ? (
        <>
          <Text style={styles.sectionLabel}>Loan Terms (for the payoff projection on the account page)</Text>
          <TextField
            label="Interest Rate (annual %)"
            value={interestRate}
            onChangeText={setInterestRate}
            keyboardType="decimal-pad"
            placeholder="e.g. 6.25"
          />
          <TextField
            label="Term (months)"
            value={termMonths}
            onChangeText={setTermMonths}
            keyboardType="number-pad"
            placeholder="e.g. 360"
          />
          <TextField
            label="Original Principal"
            value={originalPrincipal}
            onChangeText={setOriginalPrincipal}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          <TextField label="Origination Date" value={originationDate} onChangeText={setOriginationDate} placeholder="YYYY-MM-DD" />
        </>
      ) : null}
      <Pressable style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
