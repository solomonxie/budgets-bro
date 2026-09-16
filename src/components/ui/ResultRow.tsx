import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

export type ResultTone = 'default' | 'positive' | 'negative' | 'muted';

interface ResultRowProps {
  label: string;
  value: string;
  big?: boolean;
  tone?: ResultTone;
  hint?: string;
}

const TONE_COLOR: Record<ResultTone, string> = {
  default: colors.text,
  positive: colors.positive,
  negative: colors.negative,
  muted: colors.textMuted,
};

// A calculator's label/value line. `tone` exists because a result number has
// to read as good or bad at a glance — interest saved is green, a payment
// that doesn't cover the interest is red.
export function ResultRow({ label, value, big, tone = 'default', hint }: ResultRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, big && styles.valueBig, { color: TONE_COLOR[tone] }]}>{value}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { fontSize: 14, color: colors.textMuted, flexShrink: 1 },
  value: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  valueBig: { fontSize: 20 },
  hint: { fontSize: 12, color: colors.textMuted },
});
