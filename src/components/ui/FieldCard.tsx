import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// One rounded panel holding the whole form, hairline-divided into rows,
// instead of a stack of individually outlined boxes — a grid of borders
// under a number pad reads as clutter.
export function FieldCard({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.card}>
      {rows.map((row, i) => (
        <View key={i}>
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
}

export function FieldRow({ label, value, onPress }: FieldRowProps) {
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
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingVertical: 10,
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
});
