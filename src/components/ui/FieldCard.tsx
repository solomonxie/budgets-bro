import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// One rounded panel holding the whole form, hairline-divided into rows,
// instead of a stack of individually outlined boxes — a grid of borders
// under a number pad reads as clutter.
// `grow` lets the card absorb whatever vertical space is left over, and
// hands it to its last row — so the spend form's pad stays put at the bottom
// whether or not the account above it offers a Category row, instead of
// riding up and down with the row count.
export function FieldCard({ children, grow }: { children: ReactNode; grow?: boolean }) {
  const rows = Children.toArray(children);
  return (
    <View style={[styles.card, grow && styles.cardGrow]}>
      {rows.map((row, i) => (
        <View key={i} style={grow && i === rows.length - 1 ? styles.growRow : undefined}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}

interface FieldRowProps {
  label: string;
  // Empty means nothing picked yet: the row shows its label alone, the way
  // a placeholder would, rather than a caption over a blank line.
  value: string;
  // Omitted for a row whose value isn't the user's to change — it reads the
  // same but doesn't invite a tap that would do nothing.
  onPress?: () => void;
  // The row's picker is unfolded right below it (see ExpandingField) — the
  // chevron turns to point at it instead of off to the right.
  expanded?: boolean;
}

export function FieldRow({ label, value, onPress, expanded }: FieldRowProps) {
  if (!onPress) {
    return (
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={[styles.rowValue, styles.rowValueLocked]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.rowText}>
        {value ? (
          <>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {value}
            </Text>
          </>
        ) : (
          <Text style={styles.rowPlaceholder} numberOfLines={1}>
            {label}
          </Text>
        )}
      </View>
      <Text style={[styles.chevron, expanded && styles.chevronExpanded]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  // Grows into leftover space but never shrinks below its content: a row with
  // a picker unfolded inside it makes the card taller than the screen, and
  // `flex: 1` would have the card clip it against its own overflow: 'hidden'
  // instead of letting the page scroll.
  cardGrow: { flexGrow: 1, flexShrink: 0 },
  growRow: { flexGrow: 1, flexShrink: 0 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Tight enough that a six-row form still leaves the spend page's pad
    // fully on screen, tall enough to stay a comfortable target.
    minHeight: 48,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowPressed: { backgroundColor: colors.border },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  rowValue: { fontSize: 16, color: colors.text },
  rowValueLocked: { color: colors.textMuted },
  rowPlaceholder: { fontSize: 16, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted },
  chevronExpanded: { transform: [{ rotate: '90deg' }], color: colors.accent },
});
