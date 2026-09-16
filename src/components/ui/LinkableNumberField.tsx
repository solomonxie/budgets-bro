import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { DropdownOption } from './DropdownField';
import { accountValueFor, linkedValueToFieldText } from '../../finance-tools/accountLink';
import type { LinkableQuantity } from '../../finance-tools/accountLink';
import type { AccountWithBalance } from '../../db/repositories/accountsRepo';
import { currentDateISO } from '../../domain/month';
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';

interface LinkableNumberFieldProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  label: string;
  quantity: LinkableQuantity;
  value: string;
  onChangeText: (text: string) => void;
  linkedAccountId: number | null;
  onLink: (accountId: number | null) => void;
  accountFilter?: (account: AccountWithBalance) => boolean;
}

// A calculator number you can either type or pull off a real account. The
// link is a prefill source for one figure — an account's own payment-pinned
// projection still lives only in its account page, not here.
//
// The field starts empty like every other calculator input; linking fills it,
// unlinking leaves the number behind so it stays editable.
export function LinkableNumberField({
  label,
  quantity,
  value,
  onChangeText,
  linkedAccountId,
  onLink,
  accountFilter,
  style,
  ...props
}: LinkableNumberFieldProps) {
  const t = useT();
  const { accounts } = useAccounts();
  const [pickerOpen, setPickerOpen] = useState(false);

  const eligible = useMemo(
    () => accounts.filter((a) => a.account.archivedAt == null && (accountFilter?.(a) ?? true)),
    [accounts, accountFilter],
  );
  const linked = eligible.find((a) => a.account.id === linkedAccountId) ?? null;

  // Only the selected account's rates — a hook per row of the picker would be
  // one query per account for a value most of them never get asked for.
  const { currentRateBps } = useAccountRateHistory(linked ? linked.account.id : null);
  const pulled = linked ? accountValueFor(quantity, linked, currentRateBps, currentDateISO()) : null;

  useEffect(() => {
    if (pulled == null) return;
    const text = linkedValueToFieldText(quantity, pulled);
    if (text !== value) onChangeText(text);
  }, [pulled, quantity, value, onChangeText]);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {/* No eligible account — a trigger that opens an empty sheet is worse
            than no trigger, and the field works fine typed. */}
        {eligible.length > 0 ? (
          <Pressable onPress={() => setPickerOpen(true)}>
            <Text style={styles.link} numberOfLines={1}>
              {linked ? linked.account.name : t('financeTools.linkAccount')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        style={[styles.input, linked != null && styles.inputLinked, style]}
        value={value}
        onChangeText={onChangeText}
        editable={linked == null}
        placeholderTextColor={colors.textMuted}
        keyboardAppearance="dark"
        keyboardType="decimal-pad"
        {...props}
      />
      {linked != null && pulled == null ? <Text style={styles.hint}>{t('financeTools.accountMissingValue')}</Text> : null}

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <BottomSheet title={label} onClose={() => setPickerOpen(false)}>
          <DropdownOption
            label={t('financeTools.enterManually')}
            selected={linkedAccountId == null}
            onPress={() => {
              onLink(null);
              setPickerOpen(false);
            }}
          />
          {eligible.map((a) => (
            <DropdownOption
              key={a.account.id}
              label={a.account.name}
              selected={linkedAccountId === a.account.id}
              onPress={() => {
                onLink(a.account.id);
                setPickerOpen(false);
              }}
            />
          ))}
        </BottomSheet>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, flexShrink: 1 },
  link: { fontSize: 13, fontWeight: '600', color: colors.accent },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  inputLinked: { color: colors.textMuted },
  hint: { fontSize: 12, color: colors.amber },
});
