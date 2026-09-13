import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { DateField } from '../../components/ui/DateField';
import { DropdownField, DropdownGroupLabel, DropdownOption } from '../../components/ui/DropdownField';
import { SearchableDropdownField } from '../../components/ui/SearchableDropdownField';
import { RepeatField } from '../../components/ui/RepeatField';
import { getDb } from '../../db/client';
import * as scheduledTransactionsRepo from '../../db/repositories/scheduledTransactionsRepo';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { useAppStore } from '../../state/useAppStore';
import { currentDateISO } from '../../domain/month';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ruleForPreset } from '../../domain/recurrence';
import type { RecurrenceRule } from '../../domain/recurrence';

// Create/edit a recurring-transaction schedule (T8.9) — same "one sheet,
// create or edit" pattern as AccountModal, with the transaction-entry
// fields (AddTransactionModal) plus the scheduling fields (frequency,
// interval, next/end date, auto-post).
export function ScheduledTransactionModal() {
  const t = useT();
  const { open: isOpen, editingId } = useAppStore((s) => s.scheduledTransactionModal);
  const close = useAppStore((s) => s.closeScheduledTransactionModal);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { accounts } = useAccounts();
  const { groups, categories } = useCategories();
  const { payees } = usePayees();
  const isEditing = editingId != null;

  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [payee, setPayee] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [rule, setRule] = useState<RecurrenceRule>(ruleForPreset('monthly'));
  const [nextDate, setNextDate] = useState(currentDateISO());
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(currentDateISO());
  const [autoPost, setAutoPost] = useState(false);

  const isTrackingAccount = accounts.find((a) => a.account.id === accountId)?.account.onBudget === false;

  const reset = () => {
    setAmount('');
    setDirection('out');
    setPayee('');
    setCategoryId(null);
    setMemo('');
    setRule(ruleForPreset('monthly'));
    setNextDate(currentDateISO());
    setHasEndDate(false);
    setEndDate(currentDateISO());
    setAutoPost(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editingId == null) {
      if (accounts.length > 0) setAccountId((prev) => prev ?? accounts[0].account.id);
      return;
    }
    (async () => {
      const db = await getDb();
      const s = await scheduledTransactionsRepo.getScheduledTransaction(db, editingId);
      if (!s) return;
      setAmount(String(Math.abs(s.amountCents) / 100));
      setDirection(s.amountCents < 0 ? 'out' : 'in');
      setPayee(s.payeeName ?? '');
      setCategoryId(s.categoryId);
      setAccountId(s.accountId);
      setMemo(s.memo ?? '');
      setRule({ frequency: s.frequency, intervalN: s.intervalN, daysOfWeekMask: s.daysOfWeekMask });
      setNextDate(s.nextDate);
      setHasEndDate(s.endDate != null);
      setEndDate(s.endDate ?? currentDateISO());
      setAutoPost(s.autoPost);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  const cancel = () => {
    close();
    reset();
  };

  const save = async () => {
    const enteredCents = Math.round((parseFloat(amount) || 0) * 100);
    if (!enteredCents || accountId == null) {
      cancel();
      return;
    }
    const db = await getDb();
    const input = {
      accountId,
      categoryId: isTrackingAccount ? null : categoryId,
      payeeName: payee,
      memo: memo || null,
      amountCents: enteredCents * (direction === 'out' ? -1 : 1),
      frequency: rule.frequency,
      intervalN: rule.intervalN,
      daysOfWeekMask: rule.daysOfWeekMask,
      nextDate,
      endDate: hasEndDate ? endDate : null,
      autoPost,
    };
    if (editingId != null) await scheduledTransactionsRepo.updateScheduledTransaction(db, boardId, { ...input, id: editingId });
    else await scheduledTransactionsRepo.createScheduledTransaction(db, boardId, input);
    bumpDataVersion();
    close();
    reset();
  };

  const remove = () => {
    if (editingId == null) return;
    Alert.alert(t('scheduledTransactionModal.deleteConfirmTitle'), t('common.cannotBeUndone'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await scheduledTransactionsRepo.deleteScheduledTransaction(db, editingId);
          bumpDataVersion();
          close();
          reset();
        },
      },
    ]);
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
      <ScreenContainer modal>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={cancel}>
              <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.title}>
              {isEditing ? t('scheduledTransactionModal.editTitle') : t('scheduledTransactionModal.newTitle')}
            </Text>
            <Pressable onPress={save}>
              <Text style={[styles.headerBtn, styles.saveBtn]}>{t('common.save')}</Text>
            </Pressable>
          </View>

          <TextField
            label={t('scheduledTransactionModal.amountLabel')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
          />
          <View style={styles.segmented}>
            <Pressable style={[styles.segment, direction === 'out' && styles.segmentActive]} onPress={() => setDirection('out')}>
              <Text style={[styles.segmentText, direction === 'out' && styles.segmentTextActive]}>{t('spend.spending')}</Text>
            </Pressable>
            <Pressable style={[styles.segment, direction === 'in' && styles.segmentActive]} onPress={() => setDirection('in')}>
              <Text style={[styles.segmentText, direction === 'in' && styles.segmentTextActive]}>{t('spend.income')}</Text>
            </Pressable>
          </View>

          <SearchableDropdownField
            compact
            label={t('common.payee')}
            valueLabel={payee}
            placeholder={t('spend.payeePlaceholder')}
            searchPlaceholder={t('spend.payeeSearchPlaceholder')}
            options={payees.map((p) => ({ id: p.id, label: p.name }))}
            onSelect={(o) => setPayee(o.label)}
            onUseText={setPayee}
          />

          {isTrackingAccount ? null : (
            <DropdownField
              compact
              label={t('common.category')}
              valueLabel={
                categoryId == null
                  ? ''
                  : (() => {
                      const c = categories.find((cat) => cat.id === categoryId);
                      return c ? `${c.icon ? c.icon + ' ' : ''}${c.name}` : '';
                    })()
              }
              placeholder={t('common.uncategorized')}
            >
              {(closeDropdown) => (
                <>
                  <DropdownOption
                    label={t('common.uncategorized')}
                    selected={categoryId == null}
                    onPress={() => {
                      setCategoryId(null);
                      closeDropdown();
                    }}
                  />
                  {groups.map((group) => {
                    const groupCategories = categories.filter((c) => c.groupId === group.id);
                    if (groupCategories.length === 0) return null;
                    return (
                      <View key={group.id}>
                        <DropdownGroupLabel label={group.name} />
                        {groupCategories.map((c) => (
                          <DropdownOption
                            key={c.id}
                            label={`${c.icon ? c.icon + ' ' : ''}${c.name}`}
                            selected={categoryId === c.id}
                            onPress={() => {
                              setCategoryId(c.id);
                              closeDropdown();
                            }}
                          />
                        ))}
                      </View>
                    );
                  })}
                </>
              )}
            </DropdownField>
          )}

          <DropdownField
            compact
            label={t('common.account')}
            valueLabel={accounts.find((a) => a.account.id === accountId)?.account.name ?? ''}
          >
            {(closeDropdown) => (
              <>
                {accounts.map(({ account }) => (
                  <DropdownOption
                    key={account.id}
                    label={account.name}
                    selected={accountId === account.id}
                    onPress={() => {
                      setAccountId(account.id);
                      if (!account.onBudget) setCategoryId(null);
                      closeDropdown();
                    }}
                  />
                ))}
              </>
            )}
          </DropdownField>

          <TextField label={t('scheduledTransactionModal.memoLabel')} value={memo} onChangeText={setMemo} placeholder={t('spend.memoPlaceholder')} />

          <Text style={styles.sectionLabel}>{t('scheduledTransactionModal.scheduleHeading')}</Text>
          <DateField label={t('scheduledTransactionModal.nextDateLabel')} value={nextDate} onChange={setNextDate} />
          <RepeatField label={t('scheduledTransactionModal.repeatLabel')} rule={rule} onChange={setRule} startDate={nextDate} />
          <Pressable style={styles.checkboxRow} onPress={() => setHasEndDate((v) => !v)}>
            <View style={[styles.checkbox, hasEndDate && styles.checkboxChecked]}>
              {hasEndDate ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkboxLabel}>{t('scheduledTransactionModal.hasEndDateLabel')}</Text>
          </Pressable>
          {hasEndDate ? <DateField label={t('scheduledTransactionModal.endDateLabel')} value={endDate} onChange={setEndDate} /> : null}

          <View style={styles.field}>
            <Text style={styles.label}>{t('scheduledTransactionModal.postingLabel')}</Text>
            <View style={styles.segmented}>
              <Pressable style={[styles.segment, !autoPost && styles.segmentActive]} onPress={() => setAutoPost(false)}>
                <Text style={[styles.segmentText, !autoPost && styles.segmentTextActive]}>
                  {t('scheduledTransactionModal.manualApprove')}
                </Text>
              </Pressable>
              <Pressable style={[styles.segment, autoPost && styles.segmentActive]} onPress={() => setAutoPost(true)}>
                <Text style={[styles.segmentText, autoPost && styles.segmentTextActive]}>
                  {t('scheduledTransactionModal.autoPost')}
                </Text>
              </Pressable>
            </View>
          </View>

          {isEditing ? (
            <Pressable style={styles.deleteButton} onPress={remove}>
              <Text style={styles.deleteButtonText}>{t('scheduledTransactionModal.deleteSchedule')}</Text>
            </Pressable>
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
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkboxLabel: { fontSize: 14, color: colors.text },
  deleteButton: { alignItems: 'center', paddingVertical: spacing.sm },
  deleteButtonText: { color: colors.negative, fontWeight: '700' },
});
