import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { getDb } from '../../db/client';
import * as accountHouseValueHistoryRepo from '../../db/repositories/accountHouseValueHistoryRepo';
import { useAccountHouseValueHistory } from '../../hooks/useAccountHouseValueHistory';
import { useAppStore } from '../../state/useAppStore';
import { HouseValueModal } from '../../components/ui/HouseValueModal';
import type { HouseValueChangeValue } from '../../components/ui/HouseValueModal';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Account, AccountHouseValueChange } from '../../domain/types';

const CHART_WIDTH = 280;
const CHART_HEIGHT = 56;

// Manual home-value history for a mortgage account — feeds the trend line
// here and, via accountHouseValueHistoryRepo's latest-per-account query,
// the offsetting asset in Net Worth (see domain/accountKind.netWorth).
// Collapsed to one summary line by default — tap to expand, so it doesn't
// push the transaction list off screen.
export function HouseValueCard({ account, balanceCents }: { account: Account; balanceCents: number }) {
  const [expanded, setExpanded] = useState(false);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const { history, currentValueCents, refresh } = useAccountHouseValueHistory(account.id);
  const [modal, setModal] = useState<{ editing: AccountHouseValueChange | null } | null>(null);

  const submit = async (value: HouseValueChangeValue) => {
    const valueCents = Math.round(parseFloat(value.value) * 100);
    const db = await getDb();
    if (modal?.editing) await accountHouseValueHistoryRepo.updateValueChange(db, modal.editing.id, valueCents, value.effectiveDate);
    else await accountHouseValueHistoryRepo.addValueChange(db, account.id, valueCents, value.effectiveDate);
    bumpDataVersion();
    refresh();
    setModal(null);
  };

  const deleteEntry = async () => {
    if (!modal?.editing) return;
    const db = await getDb();
    await accountHouseValueHistoryRepo.deleteValueChange(db, modal.editing.id);
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
      <Pressable style={styles.summaryRow} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.label}>Home Value</Text>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryText}>{currentValueCents == null ? 'Not set' : formatMoney(currentValueCents)}</Text>
          <Text style={styles.chevron}>{expanded ? '▾' : '›'}</Text>
        </View>
      </Pressable>
      {expanded ? (
        <>
          {currentValueCents == null ? (
            <Text style={styles.hint}>No home value recorded yet.</Text>
          ) : equityCents != null ? (
            <Text style={styles.hint}>Equity: {formatMoney(equityCents)}</Text>
          ) : null}
          {chronological.length > 1 ? (
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
              <Polyline points={points.join(' ')} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ) : null}
          {history.map((h) => (
            <Pressable key={h.id} style={styles.row} onPress={() => setModal({ editing: h })}>
              <Text style={styles.rowText}>{formatMoney(h.valueCents)}</Text>
              <Text style={styles.rowDate}>effective {h.effectiveDate}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.addBtn} onPress={() => setModal({ editing: null })}>
            <Text style={styles.addBtnText}>+ Update Home Value</Text>
          </Pressable>
        </>
      ) : null}
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summaryText: { fontSize: 13, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 14, color: colors.textMuted },
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
