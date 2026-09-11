import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Chip } from '../../components/ui/Chip';
import { TextField } from '../../components/ui/TextField';
import { getDb } from '../../db/client';
import * as accountsRepo from '../../db/repositories/accountsRepo';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import { useAccounts } from '../../hooks/useAccounts';
import { useAppStore } from '../../state/useAppStore';
import { isLoanLikeType } from '../../domain/accountKind';
import { currentDateISO } from '../../domain/month';
import { computeBalanceCorrectionCents } from '../../domain/register';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Account, AccountType } from '../../domain/types';

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
  const boardId = useAppStore((s) => s.currentBoardId);
  const { accounts } = useAccounts();
  const isEditing = editingAccountId != null;

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [latestBalance, setLatestBalance] = useState('0');
  const [loadedBalanceCents, setLoadedBalanceCents] = useState(0);
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [originalPrincipal, setOriginalPrincipal] = useState('');
  const [originationDate, setOriginationDate] = useState(currentDateISO());
  const [archivedAt, setArchivedAt] = useState<Account['archivedAt']>(null);

  const reset = () => {
    setName('');
    setType('checking');
    setOpeningBalance('0');
    setLatestBalance('0');
    setLoadedBalanceCents(0);
    setInterestRate('');
    setTermMonths('');
    setOriginalPrincipal('');
    setOriginationDate(currentDateISO());
    setArchivedAt(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editingAccountId == null) return;
    (async () => {
      const db = await getDb();
      const account = await accountsRepo.getAccount(db, editingAccountId);
      if (!account) return;
      const balanceCents = accounts.find((a) => a.account.id === editingAccountId)?.balanceCents ?? account.openingBalanceCents;
      setName(account.name);
      setType(account.type);
      setOpeningBalance((account.openingBalanceCents / 100).toString());
      setLatestBalance((balanceCents / 100).toString());
      setLoadedBalanceCents(balanceCents);
      setInterestRate(account.interestRateBps != null ? (account.interestRateBps / 100).toString() : '');
      setTermMonths(account.termMonths != null ? String(account.termMonths) : '');
      setOriginalPrincipal(account.originalPrincipalCents != null ? (account.originalPrincipalCents / 100).toString() : '');
      setOriginationDate(account.originationDate ?? currentDateISO());
      setArchivedAt(account.archivedAt);
    })();
    // Deliberately excludes `accounts` — it refreshes on every write (dataVersion
    // bump), and re-running this would clobber in-progress edits with the DB's
    // latest saved balance instead of just seeding the field once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await accountsRepo.updateAccount(db, boardId, editingAccountId, input);
      const actualBalanceCents = Math.round(parseFloat(latestBalance || '0') * 100);
      const deltaCents = computeBalanceCorrectionCents(loadedBalanceCents, actualBalanceCents);
      if (deltaCents !== 0) await transactionsRepo.correctBalance(db, boardId, editingAccountId, deltaCents);
    } else {
      await accountsRepo.createAccount(db, boardId, input);
    }
    bumpDataVersion();
    close();
    reset();
  };

  const closeAccount = () => {
    Alert.alert(
      `Close "${name}"?`,
      'Hides it from your accounts list. Its transactions are kept, not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Account',
          style: 'destructive',
          onPress: async () => {
            if (editingAccountId == null) return;
            const db = await getDb();
            await accountsRepo.archiveAccount(db, editingAccountId);
            bumpDataVersion();
            close();
            reset();
          },
        },
      ],
    );
  };

  const reopenAccount = async () => {
    if (editingAccountId == null) return;
    const db = await getDb();
    await accountsRepo.reopenAccount(db, editingAccountId);
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
          {isEditing ? (
            <TextField
              label="Latest Balance"
              value={latestBalance}
              onChangeText={setLatestBalance}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          ) : null}
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
          {isEditing ? (
            <View style={styles.dangerZone}>
              {archivedAt ? (
                <Pressable onPress={reopenAccount}>
                  <Text style={styles.reopenLink}>Reopen Account</Text>
                </Pressable>
              ) : (
                <Pressable onPress={closeAccount}>
                  <Text style={styles.closeLink}>Close Account</Text>
                </Pressable>
              )}
            </View>
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
  dangerZone: { marginTop: spacing.md, alignItems: 'center' },
  closeLink: { color: colors.negative, fontWeight: '600', fontSize: 14 },
  reopenLink: { color: colors.accent, fontWeight: '600', fontSize: 14 },
});
