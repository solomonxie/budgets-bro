import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../../db/client';
import * as accountValueHistoryRepo from '../../db/repositories/accountValueHistoryRepo';
import { useAppStore } from '../../state/useAppStore';
import { LoggedValueModal } from '../../components/ui/LoggedValueModal';
import type { LoggedValueChange } from '../../components/ui/LoggedValueModal';
import { ValueHistoryChart } from './ValueHistoryChart';
import type { ValueHistoryChartMode } from './ValueHistoryChart';
import { usesLoggedValue } from '../../domain/accountKind';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type {
  Account,
  AccountValueChange,
  TransactionWithLabels,
} from '../../domain/types';

// Expanded panel under a tracking/savings/cash/asset account's balance box
// (AccountDetailScreen): value-history chart (ValueHistoryChart), history
// list/edit for its manually-logged value entries — same shell as
// HouseValueDetails, minus the equity line (a tracking/asset account's
// balance already *is* its latest logged value, see
// accountsRepo.resolveBalanceCents; savings/cash keep their normal ledger
// balance and only get this as an optional chart — there's no separate
// debt to net against either way). `mode` picks the chart's shape: 'stacked'
// splits deposited-vs-gain from this account's own transactions (see
// domain/investmentGrowth.ts) for tracking/savings/cash; 'single' is a
// plain value line for Asset accounts (cars, watches… — no "deposits"
// concept). One component for all these kinds — only the account type
// governs whether the balance itself is overridden and which chart mode
// applies.
export function TrackingValueDetails({
  account,
  history,
  currentValueCents,
  transactions,
  mode,
  refresh,
}: {
  account: Account;
  history: AccountValueChange[];
  currentValueCents: number | null;
  transactions: TransactionWithLabels[];
  mode: ValueHistoryChartMode;
  refresh: () => void;
}) {
  const t = useT();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [modal, setModal] = useState<{
    editing: AccountValueChange | null;
  } | null>(null);

  const submit = async (value: LoggedValueChange) => {
    const valueCents = Math.round(parseFloat(value.value) * 100);
    if (!Number.isFinite(valueCents)) return;
    const db = await getDb();
    const note = value.note.trim() || null;
    if (modal?.editing) {
      await accountValueHistoryRepo.updateValueChange(
        db,
        modal.editing.id,
        valueCents,
        value.effectiveDate,
        note,
      );
    } else {
      await accountValueHistoryRepo.addValueChange(
        db,
        account.id,
        valueCents,
        value.effectiveDate,
        note,
      );
    }
    bumpDataVersion();
    refresh();
    setModal(null);
  };

  const deleteEntry = async () => {
    if (!modal?.editing) return;
    const db = await getDb();
    await accountValueHistoryRepo.deleteValueChange(db, modal.editing.id);
    bumpDataVersion();
    refresh();
    setModal(null);
  };

  return (
    <View style={styles.card}>
      {currentValueCents == null ? (
        <Text style={styles.hint}>{t('trackingValueCard.noValueYet')}</Text>
      ) : null}
      <ValueHistoryChart
        history={history}
        transactions={transactions}
        mode={mode}
      />
      {history.map((h) => (
        <Pressable
          key={h.id}
          style={styles.row}
          onPress={() => setModal({ editing: h })}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.rowText}>{formatMoney(h.valueCents)}</Text>
            {h.note ? (
              <Text style={styles.rowNote} numberOfLines={2}>
                {h.note}
              </Text>
            ) : null}
          </View>
          <Text style={styles.rowDate}>
            {t('common.effectivePrefix', { date: h.effectiveDate })}
          </Text>
        </Pressable>
      ))}
      {modal == null ? (
        <Pressable
          style={styles.addBtn}
          onPress={() => setModal({ editing: null })}
        >
          <Text style={styles.addBtnText}>
            {t(
              usesLoggedValue(account.type)
                ? 'trackingValueCard.logValueUpdate'
                : 'trackingValueCard.logBalanceUpdate',
            )}
          </Text>
        </Pressable>
      ) : null}
      <LoggedValueModal
        visible={modal != null}
        title={t('trackingValueModal.title')}
        valueLabel={t('trackingValueModal.totalLabel')}
        notePlaceholder={t('trackingValueModal.notePlaceholder')}
        initial={{
          value: modal?.editing
            ? (modal.editing.valueCents / 100).toString()
            : '',
          effectiveDate: modal?.editing?.effectiveDate ?? currentDateISO(),
          note: modal?.editing?.note ?? '',
        }}
        onCancel={() => setModal(null)}
        onSubmit={submit}
        onDelete={modal?.editing ? deleteEntry : undefined}
        inline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowText: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowNote: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  rowDate: { fontSize: 12, color: colors.textMuted },
  addBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  addBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
