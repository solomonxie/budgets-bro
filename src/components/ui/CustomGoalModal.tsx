import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from './TextField';
import { DropdownField, DropdownOption } from './DropdownField';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface CustomGoalValue {
  name: string;
  targetAmount: string; // dollars, e.g. "5000"
  linkedAccountId: number | null;
  manualProgressAmount: string; // dollars — only meaningful when linkedAccountId is null
}

interface CustomGoalModalProps {
  visible: boolean;
  initial: CustomGoalValue;
  accounts: { id: number; name: string }[];
  onCancel: () => void;
  onSubmit: (value: CustomGoalValue) => void;
  onDelete?: () => void;
}

// Add/edit a Baby Steps custom goal — a name, a target amount, and either a
// linked account (progress = its live balance, not editable here) or a
// manually-typed progress amount. Same small transparent-card shell as
// RateChangeModal.
export function CustomGoalModal({ visible, initial, accounts, onCancel, onSubmit, onDelete }: CustomGoalModalProps) {
  const t = useT();
  const [name, setName] = useState(initial.name);
  const [targetAmount, setTargetAmount] = useState(initial.targetAmount);
  const [linkedAccountId, setLinkedAccountId] = useState(initial.linkedAccountId);
  const [manualProgressAmount, setManualProgressAmount] = useState(initial.manualProgressAmount);

  useEffect(() => {
    if (visible) {
      setName(initial.name);
      setTargetAmount(initial.targetAmount);
      setLinkedAccountId(initial.linkedAccountId);
      setManualProgressAmount(initial.manualProgressAmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const isLinked = linkedAccountId != null;

  const submit = () => {
    if (!name.trim() || !targetAmount.trim()) return;
    onSubmit({ name: name.trim(), targetAmount, linkedAccountId, manualProgressAmount });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('customGoalModal.title')}</Text>
          <TextField label={t('customGoalModal.nameLabel')} value={name} onChangeText={setName} placeholder={t('customGoalModal.namePlaceholder')} autoFocus />
          <TextField
            label={t('customGoalModal.targetLabel')}
            value={targetAmount}
            onChangeText={setTargetAmount}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
          />
          <View style={styles.segmented}>
            <Pressable style={[styles.segment, !isLinked && styles.segmentActive]} onPress={() => setLinkedAccountId(null)}>
              <Text style={[styles.segmentText, !isLinked && styles.segmentTextActive]}>{t('customGoalModal.modeManual')}</Text>
            </Pressable>
            <Pressable
              style={[styles.segment, isLinked && styles.segmentActive]}
              onPress={() => setLinkedAccountId((id) => id ?? accounts[0]?.id ?? null)}
            >
              <Text style={[styles.segmentText, isLinked && styles.segmentTextActive]}>{t('customGoalModal.modeLinked')}</Text>
            </Pressable>
          </View>
          {isLinked ? (
            <DropdownField
              compact
              label={t('customGoalModal.linkedAccountLabel')}
              valueLabel={accounts.find((a) => a.id === linkedAccountId)?.name ?? ''}
            >
              {(closeDropdown) => (
                <>
                  {accounts.map((a) => (
                    <DropdownOption
                      key={a.id}
                      label={a.name}
                      selected={linkedAccountId === a.id}
                      onPress={() => {
                        setLinkedAccountId(a.id);
                        closeDropdown();
                      }}
                    />
                  ))}
                </>
              )}
            </DropdownField>
          ) : (
            <TextField
              label={t('customGoalModal.progressLabel')}
              value={manualProgressAmount}
              onChangeText={setManualProgressAmount}
              keyboardType="decimal-pad"
              placeholder={t('common.amountPlaceholder')}
            />
          )}
          <View style={styles.actions}>
            {onDelete ? (
              <Pressable onPress={onDelete}>
                <Text style={styles.deleteText}>{t('common.delete')}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={styles.rightActions}>
              <Pressable onPress={onCancel}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={submit}>
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  segmented: { flexDirection: 'row', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deleteText: { color: colors.negative, fontWeight: '600' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
