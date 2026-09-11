import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';
import { useAppStore } from '../../state/useAppStore';

interface FloatingAddButtonProps {
  // When set (an account's own page), the sheet opens with this account
  // preselected instead of defaulting to the first/last-used account.
  accountId?: number;
}

export function FloatingAddButton({ accountId }: FloatingAddButtonProps) {
  const openAddTransaction = useAppStore((s) => s.openAddTransaction);
  return (
    <Pressable style={styles.fab} onPress={() => openAddTransaction(accountId)}>
      <Text style={styles.text}>+ Transaction</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.accent,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
