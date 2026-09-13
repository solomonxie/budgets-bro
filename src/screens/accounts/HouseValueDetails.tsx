import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { getDb } from '../../db/client';
import * as accountValueHistoryRepo from '../../db/repositories/accountValueHistoryRepo';
import { useAppStore } from '../../state/useAppStore';
import { HouseValueModal } from '../../components/ui/HouseValueModal';
import type { HouseValueChangeValue } from '../../components/ui/HouseValueModal';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Account, AccountValueChange } from '../../domain/types';

const CHART_WIDTH = 280;
const CHART_HEIGHT = 56;

// Expanded panel under the balance box's home-value corner
// (AccountDetailScreen): history/chart/edit for a mortgage's manual
// home-value entries. Also feeds the offsetting asset in Net Worth (see
// accountValueHistoryRepo's latest-per-account query,
// domain/accountKind.netWorth).
export function HouseValueDetails({
  account,
  balanceCents,
  history,
  currentValueCents,
  refresh,
}: {
  account: Account;
  balanceCents: number;
  history: AccountValueChange[];
  currentValueCents: number | null;
  refresh: () => void;
}) {
  const t = useT();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [modal, setModal] = useState<{ editing: AccountValueChange | null } | null>(null);

  const submit = async (value: HouseValueChangeValue) => {
    const valueCents = Math.round(parseFloat(value.value) * 100);
    const db = await getDb();
    if (modal?.editing) await accountValueHistoryRepo.updateValueChange(db, modal.editing.id, valueCents, value.effectiveDate);
    else await accountValueHistoryRepo.addValueChange(db, account.id, valueCents, value.effectiveDate);
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

  // balanceCents is negative (amount owed) — equity is what's left after it.
  const equityCents = currentValueCents != null ? currentValueCents + balanceCents : null;

  const chronological = [...history].reverse(); // history is latest-first; the trend reads oldest→newest
  const values = chronological.map((h) => h.valueCents);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const points = chronological.map((h, i) => {
    const x = (i / (chronological.length - 1)) * CHART_WIDTH;
    const y = maxValue === minValue ? CHART_HEIGHT / 2 : CHART_HEIGHT - ((h.valueCents - minValue) / (maxValue - minValue)) * (CHART_HEIGHT - 8) - 4;
    return `${x},${y}`;
  });

  return (
    <View style={styles.card}>
      {currentValueCents == null ? (
        <Text style={styles.hint}>{t('houseValueCard.noValueYet')}</Text>
      ) : equityCents != null ? (
        <Text style={styles.hint}>{t('houseValueCard.equity', { amount: formatMoney(equityCents) })}</Text>
      ) : null}
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
        <Text style={styles.addBtnText}>{t('houseValueCard.updateButton')}</Text>
      </Pressable>
      <HouseValueModal
        visible={modal != null}
        initial={{
          value: modal?.editing ? (modal.editing.valueCents / 100).toString() : '',
          effectiveDate: modal?.editing?.effectiveDate ?? currentDateISO(),
        }}
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
