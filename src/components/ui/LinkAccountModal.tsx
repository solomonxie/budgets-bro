import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface EligibleAccount {
  id: number;
  name: string;
  // Name of the *other* category currently linked to this account, if
  // any — picking this account moves the link here and away from that
  // one (see categoriesRepo.linkCategoryToAccount).
  linkedToOtherCategory?: string | null;
}

interface LinkAccountModalProps {
  visible: boolean;
  eligibleAccounts: EligibleAccount[];
  currentlyLinkedAccountId: number | null;
  onSelect: (accountId: number) => void;
  onUnlink: () => void;
  onClose: () => void;
}

// Links this category to a debt account (mortgage/loan). Once linked, a
// transaction categorized here does two things: it counts as spending
// against this category's budget *and* posts a matching credit to the
// linked account, reducing its debt — same as a real loan payment. Only
// one category can be linked per account; picking one steals the link
// away from wherever it currently sits.
export function LinkAccountModal({ visible, eligibleAccounts, currentlyLinkedAccountId, onSelect, onUnlink, onClose }: LinkAccountModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Link to Account</Text>
          <Text style={styles.hint}>
            Once linked, a transaction categorized here also posts to the account below, reducing its debt — like
            recording a real loan/mortgage payment in one step. Only one category can be linked per account.
          </Text>
          <ScrollView>
            {eligibleAccounts.length === 0 ? (
              <Text style={styles.empty}>No loan/mortgage accounts to link. Create one first (Accounts → + Add Account).</Text>
            ) : (
              eligibleAccounts.map((a) => (
                <Pressable key={a.id} style={styles.option} onPress={() => onSelect(a.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionText}>{a.name}</Text>
                    {a.linkedToOtherCategory ? (
                      <Text style={styles.optionSub}>Currently linked to “{a.linkedToOtherCategory}” — picking this moves it here</Text>
                    ) : null}
                  </View>
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
    gap: spacing.sm,
  },
  optionText: { fontSize: 15, color: colors.text },
  optionSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
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
