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
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
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

  useEffect(() => {
    if (accountId == null) return;
    (async () => {
      const db = await getDb();
      const account = await accountsRepo.getAccount(db, accountId);
      if (account) {
        setName(account.name);
        setType(account.type);
        setOpeningBalance((account.openingBalanceCents / 100).toString());
      }
    })();
  }, [accountId]);

  const save = async () => {
    if (!name.trim()) return;
    const db = await getDb();
    const openingBalanceCents = Math.round(parseFloat(openingBalance || '0') * 100);
    const input = { name: name.trim(), type, openingBalanceCents };
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
      <Pressable style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
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
