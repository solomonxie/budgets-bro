import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NumberPad } from '../../components/ui/NumberPad';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import type { MenuItem } from '../../components/ui/RowMenuButton';
import {
  AmountExpression,
  amountCents,
  amountFromCents,
  formatAmountExpression,
} from '../../domain/amountExpression';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface CategoryAssignPanelProps {
  initialCents: number;
  unassignedCents: number;
  lastMonthAssignedCents: number;
  rolloverCents: number;
  onSave: (cents: number) => void;
  onCancel: () => void;
  onHistory: () => void;
  onMove: (direction: 'up' | 'down') => void;
  // Rename and delete: things you do to the category rather than to its
  // money, so they fold away behind a "⋯" instead of sitting in the same
  // row as the controls you came here to use.
  menuItems: MenuItem[];
  // Fired once the panel has a size — the row it belongs to can't be
  // scrolled fully into view until the pad is actually there to measure.
  onLaidOut?: () => void;
}

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
// The bar reads left to right by weight: reordering is two arrows in a
// cluster (a direction needs no word, and two full-width buttons for it
// crowded out everything else), the naming actions are plain links in the
// middle, and delete sits alone at the far end in red — the one action you
// should never reach by accident.
export function CategoryAssignPanel({
  initialCents,
  unassignedCents,
  lastMonthAssignedCents,
  rolloverCents,
  onSave,
  onCancel,
  onHistory,
  onMove,
  menuItems,
  onLaidOut,
}: CategoryAssignPanelProps) {
  const t = useT();
  const [amount, setAmount] = useState<AmountExpression>(
    amountFromCents(initialCents),
  );
  const [error, setError] = useState<string | null>(null);

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
          amount: formatMoney(cents - availableCents),
        }),
      );
      return;
    }
    onSave(cents);
  };

  return (
    <View style={styles.panel} onLayout={() => onLaidOut?.()}>
      <Text style={styles.label}>
        {t('assignedAmountModal.assignedThisMonth')}
      </Text>
      <Text style={styles.amount}>{formatAmountExpression(amount)}</Text>
      {rolloverCents !== 0 ? (
        <Text style={styles.hint}>
          {t('assignedAmountModal.rolloverHint', {
            amount: formatMoney(rolloverCents),
          })}
        </Text>
      ) : null}
      <Text style={styles.hint}>
        {t('assignedAmountModal.unassignedHint', {
          unassigned: formatMoney(unassignedCents),
          lastMonth: formatMoney(lastMonthAssignedCents),
        })}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <NumberPad
        value={amount}
        onChange={(next) => {
          setAmount(next);
          if (error) setError(null);
        }}
        submitLabel={t('common.done')}
        onSubmit={done}
        bottomLeft={{ label: t('common.cancel'), onPress: onCancel }}
        bottomRight={{
          label: t('assignedAmountModal.history'),
          onPress: onHistory,
        }}
      />
      <View style={styles.actions}>
        <Pressable
          style={styles.iconButton}
          onPress={() => onMove('up')}
          accessibilityLabel={t('budget.moveUp')}
          hitSlop={8}
        >
          <Text style={styles.iconText}>↑</Text>
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => onMove('down')}
          accessibilityLabel={t('budget.moveDown')}
          hitSlop={8}
        >
          <Text style={styles.iconText}>↓</Text>
        </Pressable>
        <View style={styles.menuButton}>
          <RowMenuButton items={menuItems} />
        </View>
      </View>
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
  amount: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  error: {
    fontSize: 12,
    color: colors.negative,
    textAlign: 'center',
    fontWeight: '600',
  },
  // The three category controls, left-aligned in one cluster — the pad above
  // already owns the right-hand side, and spreading these to both edges made
  // the panel read as two unrelated toolbars.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 16, color: colors.text, lineHeight: 20 },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
