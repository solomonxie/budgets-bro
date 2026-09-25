import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../../db/client';
import * as accountValueHistoryRepo from '../../db/repositories/accountValueHistoryRepo';
import { useAppStore } from '../../state/useAppStore';
import { LoggedValueModal } from '../../components/ui/LoggedValueModal';
import type { LoggedValueChange } from '../../components/ui/LoggedValueModal';
import { ValueHistoryChart } from './ValueHistoryChart';
import { useAccountValueHistory } from '../../hooks/useAccountValueHistory';
import { buildEquitySeries } from '../../domain/equityHistory';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
import {
  currentDateISO,
  currentMonth,
  monthsBetween,
} from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Account, AccountValueChange } from '../../domain/types';

// Expanded panel under the balance box's home-value corner
// (AccountDetailScreen): history/chart/edit for a mortgage's manual
// home-value entries. Also feeds the offsetting asset in Net Worth (see
// accountValueHistoryRepo's latest-per-account query,
// domain/accountKind.netWorth).
export function HouseValueDetails({
  account,
  balanceCents,
  history,
  transactions,
  currentValueCents,
  refresh,
  info,
}: {
  account: Account;
  balanceCents: number;
  history: AccountValueChange[];
  // The payments themselves — what moves the debt between statements.
  transactions: { amountCents: number; date: string }[];
  currentValueCents: number | null;
  refresh: () => void;
  // Under the chart, above the readings — the section's "How this works".
  info?: ReactNode;
}) {
  const t = useT();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  // The other half of the picture: what is still owed, logged on the loan
  // side of the same account (see LoanDetailsCard).
  const { history: principalHistory } = useAccountValueHistory(
    account.id,
    'principal',
  );
  const { currentRateBps } = useAccountRateHistory(account.id);
  // From the day the loan was signed: the debt starts at the whole amount
  // borrowed and the equity at the down payment, and every payment since
  // moves a little from one to the other.
  const equitySeries = useMemo(() => {
    const startMonth = (
      account.originationDate ??
      history.at(-1)?.effectiveDate ??
      account.createdAt
    ).slice(0, 7);
    return buildEquitySeries({
      months: monthsBetween(startMonth, currentMonth()),
      valueReadings: history,
      principalReadings: principalHistory,
      payments: transactions.map((tx) => ({
        date: tx.date,
        amountCents: tx.amountCents,
      })),
      terms: {
        originalPrincipalCents: account.originalPrincipalCents,
        originationDate: account.originationDate,
        termMonths: account.termMonths,
        openingBalanceCents: account.openingBalanceCents,
        fallbackDate: account.createdAt.slice(0, 10),
      },
      originalHousePriceCents: account.originalHousePriceCents,
      annualRateBps: currentRateBps,
      asOfDate: currentDateISO(),
    });
  }, [account, history, principalHistory, transactions, currentRateBps]);
  const [modal, setModal] = useState<{
    editing: AccountValueChange | null;
  } | null>(null);

  const submit = async (value: LoggedValueChange) => {
    const valueCents = Math.round(parseFloat(value.value) * 100);
    const db = await getDb();
    const note = value.note.trim() || null;
    if (modal?.editing)
      await accountValueHistoryRepo.updateValueChange(
        db,
        modal.editing.id,
        valueCents,
        value.effectiveDate,
        note,
      );
    else
      await accountValueHistoryRepo.addValueChange(
        db,
        account.id,
        valueCents,
        value.effectiveDate,
        note,
      );
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
  const equityCents =
    currentValueCents != null ? currentValueCents + balanceCents : null;

  return (
    <View style={styles.card}>
      {currentValueCents == null ? (
        <Text style={styles.hint}>{t('houseValueCard.noValueYet')}</Text>
      ) : equityCents != null ? (
        <Text style={styles.hint}>
          {t('houseValueCard.equity', { amount: formatMoney(equityCents) })}
        </Text>
      ) : null}
      {/* Two lines over the same ground rather than one atop the other:
          the debt coming down and the equity going up, and the month they
          cross. */}
      <ValueHistoryChart
        history={history}
        series={equitySeries}
        mode="overlay"
        baseColor={colors.negative}
        labels={{
          base: t('houseValueCard.owedLabel'),
          top: t('houseValueCard.equityLabel'),
        }}
      />
      {info}
      {history.map((h) => (
        <Pressable
          key={h.id}
          style={styles.row}
          onPress={() => setModal({ editing: h })}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.rowText}>{formatMoney(h.valueCents)}</Text>
            {h.note ? (
              <Text style={styles.rowNote} numberOfLines={1}>
                {h.note}
              </Text>
            ) : null}
          </View>
          <Text style={styles.rowDate}>
            {t('common.effectivePrefix', { date: h.effectiveDate })}
          </Text>
        </Pressable>
      ))}
      {/* The form takes the button's place rather than appearing under it,
          so the card never shows two ways to start the same thing. */}
      {modal == null ? (
        <Pressable
          style={styles.addBtn}
          onPress={() => setModal({ editing: null })}
        >
          <Text style={styles.addBtnText}>
            {t('houseValueCard.updateButton')}
          </Text>
        </Pressable>
      ) : null}
      <LoggedValueModal
        visible={modal != null}
        title={t('houseValueModal.title')}
        valueLabel={t('houseValueModal.valueLabel')}
        notePlaceholder={t('houseValueModal.notePlaceholder')}
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
  rowNote: { fontSize: 12, color: colors.textMuted },
  rowDate: { fontSize: 12, color: colors.textMuted },
  addBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  addBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
