import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../../db/client';
import * as accountValueHistoryRepo from '../../db/repositories/accountValueHistoryRepo';
import { useAppStore } from '../../state/useAppStore';
import { TrackingValueModal } from '../../components/ui/TrackingValueModal';
import type { TrackingValueSubmit } from '../../components/ui/TrackingValueModal';
import { ValueHistoryChart } from './ValueHistoryChart';
import type { ValueHistoryChartMode } from './ValueHistoryChart';
import { buildGrowthSeries } from '../../domain/investmentGrowth';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Account, AccountValueChange, TransactionWithLabels } from '../../domain/types';

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
  const [modal, setModal] = useState<{ editing: AccountValueChange | null } | null>(null);

  const submit = async (value: TrackingValueSubmit) => {
    const db = await getDb();
    if (modal?.editing) await accountValueHistoryRepo.updateValueChange(db, modal.editing.id, value.valueCents, value.effectiveDate);
    else await accountValueHistoryRepo.addValueChange(db, account.id, value.valueCents, value.effectiveDate);
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

  // Before any real log entry exists, "previous" falls back to the
  // deposits-implied current value (see domain/investmentGrowth.ts) rather
  // than null — so logging "+$10 interest" on a $500-deposited account
  // with no prior log produces $510, not $10.
  const impliedCurrentValueCents = buildGrowthSeries(history, transactions).at(-1)?.totalCents ?? null;

  // Editing an existing entry re-derives its "previous" value from the row
  // right before it in history, not the account's current latest value —
  // otherwise gain-mode math would be wrong when editing anything but the
  // most recent entry.
  const previousValueCents = (() => {
    if (!modal?.editing) return currentValueCents ?? impliedCurrentValueCents;
    const idx = history.findIndex((h) => h.id === modal.editing!.id);
    return idx >= 0 && idx + 1 < history.length ? history[idx + 1].valueCents : null;
  })();

  return (
    <View style={styles.card}>
      {currentValueCents == null ? <Text style={styles.hint}>{t('trackingValueCard.noValueYet')}</Text> : null}
      <ValueHistoryChart history={history} transactions={transactions} mode={mode} />
      {history.map((h) => (
        <Pressable key={h.id} style={styles.row} onPress={() => setModal({ editing: h })}>
          <Text style={styles.rowText}>{formatMoney(h.valueCents)}</Text>
          <Text style={styles.rowDate}>{t('common.effectivePrefix', { date: h.effectiveDate })}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.addBtn} onPress={() => setModal({ editing: null })}>
        <Text style={styles.addBtnText}>{t('trackingValueCard.updateButton')}</Text>
      </Pressable>
      <TrackingValueModal
        visible={modal != null}
        previousValueCents={previousValueCents}
        initialValueCents={modal?.editing?.valueCents ?? null}
        initialEffectiveDate={modal?.editing?.effectiveDate ?? currentDateISO()}
        onCancel={() => setModal(null)}
        onSubmit={submit}
        onDelete={modal?.editing ? deleteEntry : undefined}
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
  rowText: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowDate: { fontSize: 12, color: colors.textMuted },
  addBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  addBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
