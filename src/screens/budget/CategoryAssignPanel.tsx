import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NumberPad } from '../../components/ui/NumberPad';
import { MenuSheet, RowMenuButton } from '../../components/ui/RowMenuButton';
import type { MenuItem } from '../../components/ui/RowMenuButton';
import {
  AmountExpression,
  amountCents,
  amountFromCents,
  formatAmountExpression,
} from '../../domain/amountExpression';
import { formatMoney, formatMoneyExact } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface CategoryAssignPanelProps {
  initialCents: number;
  unassignedCents: number;
  // Net spending per month over the last 12.
  avgSpentCents: number;
  rolloverCents: number;
  // A month before this one: its leftovers have already moved up into
  // `currentMonthLabel`, so there is nothing left to assign here.
  closed: boolean;
  currentMonthLabel: string;
  onSave: (cents: number) => void;
  onHistory: () => void;
  // This category's balance: when nothing more is typed, taking from
  // another category covers an overspend.
  balanceCents: number;
  onTakeFrom: (cents: number) => void;
  // Move, rename and delete: things you do to the category rather than to its
  // money, so they fold away behind a "⋯" instead of sitting in the same
  // row as the controls you came here to use.
  menuItems: MenuItem[];
  // Fired once the panel has a size — the row it belongs to can't be
  // scrolled fully into view until the pad is actually there to measure.
  onLaidOut?: () => void;
}

// Past this multiple of the usual month, the assignment reads red.
const HIGH_VS_AVG = 1.5;

// Assigning money unfolds under the category row, with the app's own pad —
// the same shape as entering a spend (see AddTransactionScreen). It used to
// be a popup over a system number-pad keyboard, which could only take digits:
// deciding what to assign is nearly always arithmetic ("what's there plus
// another forty"), and the pad does that on the spot.
//
// Its actions sit inline along the bottom rather than behind a "⋯" sheet.
// The row is already open; a menu that slides another sheet over it to offer
// four things is a layer nobody needs once there is room to just show them.
//
// Everything besides typing and Done folds behind the pad's "⋯" key: moving
// money in, reordering, renaming, deleting. Tapping the row again closes it.
export function CategoryAssignPanel({
  initialCents,
  unassignedCents,
  avgSpentCents,
  rolloverCents,
  closed,
  currentMonthLabel,
  onSave,
  onHistory,
  balanceCents,
  onTakeFrom,
  menuItems,
  onLaidOut,
}: CategoryAssignPanelProps) {
  const t = useT();
  const [amount, setAmount] = useState<AmountExpression>(
    amountFromCents(initialCents),
  );
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const revealed = useRef(false);
  const typed = formatAmountExpression(amount);

  // Raising this category's assignment draws from unassigned cash — capped
  // at what's currently unassigned plus whatever's already here. Lowering it
  // is always allowed, even when Unassigned is already negative: that is the
  // only way to claw it back.
  const availableCents = unassignedCents + initialCents;

  const done = () => {
    const cents = amountCents(amount);
    if (cents > initialCents && cents > availableCents) {
      setError(
        t('assignedAmountModal.exceedsError', {
          amount: formatMoneyExact(cents - availableCents),
        }),
      );
      return;
    }
    onSave(cents);
  };

  const takeFrom = () => {
    const typedCents = amountCents(amount);
    const cents =
      typedCents > initialCents
        ? typedCents - initialCents
        : Math.max(0, -balanceCents);
    if (cents === 0) {
      setError(t('budget.takeFromNeedsAmount'));
      return;
    }
    onTakeFrom(cents);
  };

  return (
    <View
      style={styles.panel}
      // Once: re-revealing on every resize scrolled the page while typing.
      onLayout={() => {
        if (revealed.current) return;
        revealed.current = true;
        onLaidOut?.();
      }}
    >
      <Text style={styles.label}>
        {t('assignedAmountModal.assignedThisMonth')}
      </Text>
      <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
        <Text
          style={[
            !typed && styles.amountPlaceholder,
            avgSpentCents > 0 &&
              amountCents(amount) > avgSpentCents * HIGH_VS_AVG &&
              styles.amountHigh,
          ]}
        >
          {typed || formatMoney(0)}
        </Text>
      </Text>
      <Text style={styles.hint}>
        {t('assignedAmountModal.unassignedHint', {
          // To the cent: rounded, $124.87 reads as $125 and typing that
          // fails with "$0 more than you have".
          unassigned: formatMoneyExact(unassignedCents),
        })}
        {t('assignedAmountModal.avgSpent', {
          amount: formatMoney(avgSpentCents),
        })}
      </Text>
      {rolloverCents !== 0 ? (
        <Text style={styles.hint}>
          {t('assignedAmountModal.rolloverHint', {
            amount: formatMoney(rolloverCents),
          })}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {closed ? (
        <Text style={[styles.hint, styles.closedNote]}>
          {t('assignedAmountModal.closedHint', { month: currentMonthLabel })}
        </Text>
      ) : (
        <NumberPad
          value={amount}
          onChange={(next) => {
            setAmount(next);
            if (error) setError(null);
          }}
          submitLabel={t('common.done')}
          onSubmit={done}
          bottomLeft={{
            label: t('assignedAmountModal.history'),
            onPress: onHistory,
          }}
          extra={{ label: '⋯', onPress: () => setMenuOpen(true) }}
        />
      )}
      {closed ? (
        <View style={styles.actions}>
          <View style={styles.actionKey}>
            <RowMenuButton items={menuItems} />
          </View>
        </View>
      ) : null}
      <MenuSheet
        items={[{ label: t('budget.takeFrom'), onPress: takeFrom }, ...menuItems]}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    textAlign: 'center',
  },
  amountPlaceholder: { color: colors.textMuted },
  amountHigh: { color: colors.negative },
  // Fixed height: the font shrinks to fit a long figure, and the panel must
  // not change size with it.
  amount: {
    fontSize: 36,
    lineHeight: 44,
    height: 44,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  closedNote: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  error: {
    fontSize: 12,
    color: colors.negative,
    textAlign: 'center',
    fontWeight: '600',
  },
  // Read as one more row of the pad above, because that is what it is:
  // same widths, same flat keys, same patch lighting under the thumb. Three
  // outlined chips huddled at the left read as a second, unrelated toolbar
  // bolted under a borderless keyboard.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  actionKey: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
