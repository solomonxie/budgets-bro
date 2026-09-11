import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface EligibleAccount {
  id: number;
  name: string;
}

interface LinkAccountModalProps {
  visible: boolean;
  eligibleAccounts: EligibleAccount[];
  currentlyLinkedAccountId: number | null;
  onSelect: (accountId: number) => void;
  onUnlink: () => void;
  onClose: () => void;
}

// Links this category to a debt account (mortgage/loan) — a transaction
// categorized here then also posts to that account, reducing its balance.
// Only one category can be linked per account; picking one steals the
// link away from wherever it currently sits.
export function LinkAccountModal({ visible, eligibleAccounts, currentlyLinkedAccountId, onSelect, onUnlink, onClose }: LinkAccountModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Link to Account</Text>
          <Text style={styles.hint}>
            Transactions categorized here also post to the linked account, reducing its debt.
          </Text>
          <ScrollView>
            {eligibleAccounts.length === 0 ? (
              <Text style={styles.empty}>No eligible debt accounts (loan/mortgage) to link.</Text>
            ) : (
              eligibleAccounts.map((a) => (
                <Pressable key={a.id} style={styles.option} onPress={() => onSelect(a.id)}>
                  <Text style={styles.optionText}>{a.name}</Text>
                  {currentlyLinkedAccountId === a.id ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              ))
            )}
          </ScrollView>
          {currentlyLinkedAccountId != null ? (
            <Pressable style={styles.unlink} onPress={onUnlink}>
              <Text style={styles.unlinkText}>Unlink</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 17 },
  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: 15, color: colors.text },
  check: { color: colors.accent, fontWeight: '700' },
  unlink: {
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.negative,
    borderRadius: 14,
  },
  unlinkText: { color: colors.negative, fontWeight: '700' },
  cancel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '700', color: colors.text },
});
