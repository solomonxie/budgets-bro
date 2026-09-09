import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { useAccounts } from '../../hooks/useAccounts';
import { ACCOUNT_KIND_ORDER, accountKind } from '../../domain/accountKind';
import { formatMoney } from '../../domain/money';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { AccountsStackParamList } from '../../navigation/types';
import type { AccountWithBalance } from '../../db/repositories/accountsRepo';

type Nav = NativeStackNavigationProp<AccountsStackParamList, 'AccountsList'>;

export function AccountsScreen() {
  const navigation = useNavigation<Nav>();
  const { accounts } = useAccounts();

  const groups = useMemo(() => {
    return ACCOUNT_KIND_ORDER.map((kind) => {
      const list = accounts.filter((a) => accountKind(a.account.type) === kind);
      return { kind, accounts: list, subtotalCents: list.reduce((s, a) => s + a.balanceCents, 0) };
    }).filter((g) => g.accounts.length > 0);
  }, [accounts]);

  const totalCents = accounts.reduce((s: number, a: AccountWithBalance) => s + a.balanceCents, 0);

  return (
    <ScreenContainer scroll>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Balance</Text>
        <Text style={styles.summaryValue}>{formatMoney(totalCents)}</Text>
      </View>
      {groups.map((group) => (
        <View key={group.kind} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupLabel}>{group.kind}</Text>
            <Text style={styles.groupSub}>{formatMoney(group.subtotalCents)}</Text>
          </View>
          {group.accounts.map(({ account, balanceCents }) => (
            <Pressable
              key={account.id}
              style={styles.row}
              onPress={() => navigation.navigate('AccountDetail', { accountId: account.id })}
            >
              <Text style={styles.rowTitle}>{account.name}</Text>
              <Text style={[styles.rowValue, balanceCents < 0 && styles.negative]}>{formatMoney(balanceCents)}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={() => navigation.navigate('AccountForm', undefined)}>
        <Text style={styles.addButtonText}>+ Add Account</Text>
      </Pressable>
      <FloatingAddButton />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  summaryValue: { fontSize: 30, fontWeight: '700', marginTop: 4, color: colors.text },
  group: { gap: spacing.xs },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  groupLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  groupSub: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  negative: { color: colors.negative },
  addButton: { alignItems: 'center', paddingVertical: spacing.sm, marginBottom: 80 },
  addButtonText: { color: colors.accent, fontWeight: '700' },
});
