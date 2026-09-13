import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { getDb } from '../../db/client';
import * as accountValueHistoryRepo from '../../db/repositories/accountValueHistoryRepo';
import { useAppStore } from '../../state/useAppStore';
import { TrackingValueModal } from '../../components/ui/TrackingValueModal';
import type { TrackingValueSubmit } from '../../components/ui/TrackingValueModal';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Account, AccountValueChange } from '../../domain/types';

const CHART_WIDTH = 280;
const CHART_HEIGHT = 56;

// Expanded panel under a tracking account's balance box (AccountDetailScreen):
// history/chart/edit for its manually-logged value entries — same shell as
// HouseValueDetails, minus the equity line (a tracking account's balance
// already *is* its latest logged value, see accountsRepo.resolveBalanceCents;
// there's no separate debt to net against).
export function TrackingValueDetails({
  account,
  history,
  currentValueCents,
  refresh,
}: {
  account: Account;
  history: AccountValueChange[];
  currentValueCents: number | null;
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

  const chronological = [...history].reverse(); // history is latest-first; the trend reads oldest→newest
  const values = chronological.map((h) => h.valueCents);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const points = chronological.map((h, i) => {
    const x = (i / (chronological.length - 1)) * CHART_WIDTH;
    const y = maxValue === minValue ? CHART_HEIGHT / 2 : CHART_HEIGHT - ((h.valueCents - minValue) / (maxValue - minValue)) * (CHART_HEIGHT - 8) - 4;
    return `${x},${y}`;
  });

  // Editing an existing entry re-derives its "previous" value from the row
  // right before it in history, not the account's current latest value —
  // otherwise gain-mode math would be wrong when editing anything but the
  // most recent entry.
  const previousValueCents = (() => {
    if (!modal?.editing) return currentValueCents;
    const idx = history.findIndex((h) => h.id === modal.editing!.id);
    return idx >= 0 && idx + 1 < history.length ? history[idx + 1].valueCents : null;
  })();

  return (
    <View style={styles.card}>
      {currentValueCents == null ? <Text style={styles.hint}>{t('trackingValueCard.noValueYet')}</Text> : null}
      {chronological.length > 1 ? (
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          <Polyline points={points.join(' ')} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
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
