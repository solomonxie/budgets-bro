import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../../db/client';
import * as accountRateHistoryRepo from '../../db/repositories/accountRateHistoryRepo';
import { useAppStore } from '../../state/useAppStore';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
import { RateChangeModal } from '../../components/ui/RateChangeModal';
import type { RateChangeValue } from '../../components/ui/RateChangeModal';
import { currentDateISO } from '../../domain/month';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { AccountRateChange } from '../../domain/types';

// The rate a cash or savings account earns, in the balance box
// (AccountDetailScreen) rather than only behind Edit — a rate change arrives
// as a letter from the bank, and noting it belongs where the account is, not
// two taps into a form. Effective-dated with a note each, so the history says
// why it moved (see migration 025).
//
// A loan's rate already reads out in LoanDetailsCard, which does something
// with it (payment, payoff); this is for accounts where the rate is just
// something worth remembering.
export function InterestRateDetails({ accountId }: { accountId: number }) {
  const t = useT();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const { history, currentRateBps } = useAccountRateHistory(accountId);
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState<{
    editing: AccountRateChange | null;
  } | null>(null);

  const submit = async (value: RateChangeValue) => {
    const rateBps = Math.round(parseFloat(value.ratePercent) * 100);
    if (!Number.isFinite(rateBps)) return;
    const db = await getDb();
    const note = value.note.trim() || null;
    if (modal?.editing)
      await accountRateHistoryRepo.updateRateChange(
        db,
        modal.editing.id,
        rateBps,
        value.effectiveDate,
        note,
      );
    else
      await accountRateHistoryRepo.addRateChange(
        db,
        accountId,
        rateBps,
        value.effectiveDate,
        note,
      );
    bumpDataVersion();
    setModal(null);
  };

  const deleteEntry = async () => {
    if (!modal?.editing) return;
    const db = await getDb();
    await accountRateHistoryRepo.deleteRateChange(db, modal.editing.id);
    bumpDataVersion();
    setModal(null);
  };

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.summaryRow}
        onPress={() => setExpanded((v) => !v)}
      >
        <Text style={styles.label}>
          {t('accountModal.interestRateHeading')}
        </Text>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryText}>
            {currentRateBps == null
              ? t('interestRateCard.notSet')
              : `${(currentRateBps / 100).toFixed(2)}%`}
          </Text>
          <Text style={styles.chevron}>{expanded ? '▾' : '›'}</Text>
        </View>
      </Pressable>
      {expanded ? (
        <>
          {history.length === 0 ? (
            <Text style={styles.hint}>{t('accountModal.noRateRecorded')}</Text>
          ) : null}
          {history.map((rate) => (
            <Pressable
              key={rate.id}
              style={styles.row}
              onPress={() => setModal({ editing: rate })}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowText}>
                  {(rate.rateBps / 100).toFixed(2)}%
                </Text>
                {rate.note ? (
                  <Text style={styles.rowNote} numberOfLines={2}>
                    {rate.note}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.rowDate}>
                {t('common.effectivePrefix', { date: rate.effectiveDate })}
              </Text>
            </Pressable>
          ))}
          {modal == null ? (
            <Pressable
              style={styles.addBtn}
              onPress={() => setModal({ editing: null })}
            >
              <Text style={styles.addBtnText}>
                {t('interestRateCard.logRateChange')}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      <RateChangeModal
        visible={modal != null}
        initial={{
          ratePercent: modal?.editing
            ? (modal.editing.rateBps / 100).toString()
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
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
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
  rowLeft: { flex: 1, gap: 2 },
  rowText: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowNote: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  rowDate: { fontSize: 12, color: colors.textMuted },
  addBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  addBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
