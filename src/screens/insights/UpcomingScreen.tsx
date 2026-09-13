import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { useScheduledTransactions } from '../../hooks/useScheduledTransactions';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import * as scheduledTransactionsRepo from '../../db/repositories/scheduledTransactionsRepo';
import { nextOccurrenceDate } from '../../domain/recurrence';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useAppStore } from '../../state/useAppStore';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { ScheduledTransactionWithLabels } from '../../domain/types';

// Manual-approve + auto-post schedules, in one management list — "Upcoming"
// (see docs/IMPLEMENTATION_PLAN.md T8.8), distinct from an account page's
// "Scheduled" box (real, already-dated-ahead transactions, see
// useFutureTransactions). Auto-post schedules also post themselves lazily
// on app foreground (useAutoPostScheduledTransactions). Tapping a row opens
// its edit sheet (repeat rule, next/end date, etc. — ScheduledTransactionModal)
// rather than posting it, same as tapping a reminder opens its details
// instead of completing it; the dedicated "Post Now" pill (and the row
// menu's own copy of it) is the explicit early-post action.
export function UpcomingScreen() {
  const t = useT();
  const { scheduledTransactions, refresh } = useScheduledTransactions();
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const openAddScheduledTransaction = useAppStore((s) => s.openAddScheduledTransaction);
  const openEditScheduledTransaction = useAppStore((s) => s.openEditScheduledTransaction);

  const postNow = async (s: ScheduledTransactionWithLabels) => {
    const db = await getDb();
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: s.accountId,
      categoryId: s.categoryId,
      payeeName: s.payeeName ?? '',
      memo: s.memo,
      amountCents: s.amountCents,
      date: currentDateISO(),
    });
    const next = nextOccurrenceDate(s.nextDate, s.frequency, s.intervalN, s.daysOfWeekMask, s.createdAt.slice(0, 10));
    if (s.endDate != null && next > s.endDate) await scheduledTransactionsRepo.deleteScheduledTransaction(db, s.id);
    else await scheduledTransactionsRepo.setNextDate(db, s.id, next);
    bumpDataVersion();
    refresh();
  };

  const deleteSchedule = (s: ScheduledTransactionWithLabels) => {
    Alert.alert(t('upcoming.deleteConfirmTitle', { name: s.payeeName ?? t('common.noPayee') }), t('common.cannotBeUndone'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await scheduledTransactionsRepo.deleteScheduledTransaction(db, s.id);
          bumpDataVersion();
          refresh();
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <FlatList
        style={{ flex: 1 }}
        data={scheduledTransactions}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable style={styles.rowMain} onPress={() => openEditScheduledTransaction(item.id)}>
              <View style={{ flex: 1 }}>
                <View style={styles.payeeRow}>
                  <Text style={styles.payee}>{item.payeeName ?? t('common.noPayee')}</Text>
                  {item.autoPost ? <Text style={styles.autoBadge}>{t('upcoming.autoBadge')}</Text> : null}
                </View>
                <Text style={styles.sub}>
                  {item.categoryIcon ? `${item.categoryIcon} ` : ''}
                  {item.categoryName ?? t('common.uncategorized')} · {item.accountName} · {item.nextDate}
                </Text>
              </View>
              <Text style={[styles.amount, item.amountCents < 0 ? styles.negative : styles.positive]}>
                {formatMoney(item.amountCents)}
              </Text>
            </Pressable>
            <Pressable style={styles.postButton} onPress={() => postNow(item)}>
              <Text style={styles.postButtonText}>{t('upcoming.postNow')}</Text>
            </Pressable>
            <RowMenuButton
              items={[
                { label: t('common.edit'), onPress: () => openEditScheduledTransaction(item.id) },
                { label: t('upcoming.postNow'), onPress: () => postNow(item) },
                { label: t('common.delete'), destructive: true, onPress: () => deleteSchedule(item) },
              ]}
            />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t('upcoming.empty')}</Text>}
      />
      <Pressable style={styles.addButton} onPress={openAddScheduledTransaction}>
        <Text style={styles.addButtonText}>{t('upcoming.newSchedule')}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  payeeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payee: { fontSize: 15, fontWeight: '600', color: colors.text },
  autoBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  postButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  postButtonText: { color: colors.accent, fontWeight: '700', fontSize: 11 },
  amount: { fontSize: 15, fontWeight: '700' },
  negative: { color: colors.negative },
  positive: { color: colors.positive },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg },
  addButton: { alignItems: 'center', paddingVertical: spacing.sm },
  addButtonText: { color: colors.accent, fontWeight: '700' },
});
