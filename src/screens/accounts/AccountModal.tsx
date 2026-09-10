import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import type { AccountType } from '../../domain/types';

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

// Same "one sheet, create or edit" pattern as the transaction modal —
// "+ Add Account" used to push a full-screen form; this matches it.
export function AccountModal() {
  const { open: isOpen, editingAccountId } = useAppStore((s) => s.accountModal);
  const close = useAppStore((s) => s.closeAccountModal);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const isEditing = editingAccountId != null;

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [originalPrincipal, setOriginalPrincipal] = useState('');
  const [originationDate, setOriginationDate] = useState(currentDateISO());

  const reset = () => {
    setName('');
    setType('checking');
    setOpeningBalance('0');
    setInterestRate('');
    setTermMonths('');
    setOriginalPrincipal('');
    setOriginationDate(currentDateISO());
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editingAccountId == null) return;
    (async () => {
      const db = await getDb();
      const account = await accountsRepo.getAccount(db, editingAccountId);
      if (!account) return;
      setName(account.name);
      setType(account.type);
      setOpeningBalance((account.openingBalanceCents / 100).toString());
      setInterestRate(account.interestRateBps != null ? (account.interestRateBps / 100).toString() : '');
      setTermMonths(account.termMonths != null ? String(account.termMonths) : '');
      setOriginalPrincipal(account.originalPrincipalCents != null ? (account.originalPrincipalCents / 100).toString() : '');
      setOriginationDate(account.originationDate ?? currentDateISO());
    })();
  }, [isOpen, editingAccountId]);

  const cancel = () => {
    close();
    reset();
  };

  const isLoanLike = isLoanLikeType(type);

  const save = async () => {
    if (!name.trim()) {
      cancel();
      return;
    }
    const db = await getDb();
    const input = {
      name: name.trim(),
      type,
      openingBalanceCents: Math.round(parseFloat(openingBalance || '0') * 100),
      interestRateBps: isLoanLike && interestRate ? Math.round(parseFloat(interestRate) * 100) : null,
      termMonths: isLoanLike && termMonths ? Math.round(parseFloat(termMonths)) : null,
      originalPrincipalCents: isLoanLike && originalPrincipal ? Math.round(parseFloat(originalPrincipal) * 100) : null,
      originationDate: isLoanLike ? originationDate : null,
    };
    if (editingAccountId != null) {
      await accountsRepo.updateAccount(db, editingAccountId, input);
    } else {
      await accountsRepo.createAccount(db, input);
    }
    bumpDataVersion();
    close();
    reset();
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={cancel}>
              <Text style={styles.headerBtn}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>{isEditing ? 'Edit Account' : 'New Account'}</Text>
            <Pressable onPress={save}>
              <Text style={[styles.headerBtn, styles.saveBtn]}>Save</Text>
            </Pressable>
          </View>
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
        </ScrollView>
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  saveBtn: { color: colors.accent },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
