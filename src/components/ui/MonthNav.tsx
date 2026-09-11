import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface MonthNavProps {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  onPressLabel?: () => void;
}

// Shared month-switcher header for Budget and Insights — a pill card with
// circular arrow buttons, not bare gray chevrons floating on the background.
export function MonthNav({ label, onPrevious, onNext, onPressLabel }: MonthNavProps) {
  return (
    <View style={styles.bar}>
      <Pressable style={styles.arrowBtn} onPress={onPrevious} hitSlop={10}>
        <Text style={styles.arrow}>‹</Text>
      </Pressable>
      <Pressable style={styles.labelWrap} onPress={onPressLabel} hitSlop={10} disabled={!onPressLabel}>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      <Pressable style={styles.arrowBtn} onPress={onNext} hitSlop={10}>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.xs,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { fontSize: 20, fontWeight: '700', color: colors.accent, lineHeight: 22 },
  labelWrap: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  label: { fontSize: 17, fontWeight: '700', color: colors.text },
});
