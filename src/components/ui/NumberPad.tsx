import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AmountExpression,
  AmountKey,
  isAmountOperator,
  pressAmountKey,
} from '../../domain/amountExpression';
import { colors } from '../../theme/colors';

// Digits keep their phone-keypad order in the wide left block; the
// calculator keys sit in the narrow right one. Each row splits into those
// same two blocks so a key spanning a row's whole block still lines its
// edges up with the rows above — sizing keys individually made the row with
// fewer of them (one gap less to share) come out wider.
const SUBMIT = 'submit';
const ROWS: { digits: AmountKey[]; ops: AmountKey[] }[] = [
  { digits: ['1', '2', '3'], ops: ['÷', '×'] },
  { digits: ['4', '5', '6'], ops: ['−', '+'] },
  { digits: ['7', '8', '9'], ops: ['=', '⌫'] },
  { digits: ['0'], ops: [SUBMIT] },
];

interface NumberPadProps {
  value: AmountExpression;
  onChange: (next: AmountExpression) => void;
  // The pad's bottom-right key. Save belongs where the thumb already is,
  // rather than another full-width button below the pad.
  submitLabel: string;
  onSubmit: () => void;
}

// Part of the page, in the normal flow with everything else — not popped
// up, not pinned over the form. The system number pad covered half the
// screen and slid in and out on every focus change; a pinned bar reads as
// floating on top of the fields.
export function NumberPad({
  value,
  onChange,
  submitLabel,
  onSubmit,
}: NumberPadProps) {
  const renderKey = (key: AmountKey) => {
    if (key === SUBMIT)
      return (
        <Pressable
          key={key}
          style={({ pressed }) => [
            styles.key,
            styles.submitKey,
            pressed && styles.submitKeyPressed,
          ]}
          onPress={onSubmit}
        >
          <Text style={styles.submitKeyText} numberOfLines={1}>
            {submitLabel}
          </Text>
        </Pressable>
      );
    return (
      <Pressable
        key={key}
        style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
        onPress={() => onChange(pressAmountKey(value, key))}
        // No C key — holding backspace wipes the whole amount, which is the
        // only time anyone reached for it.
        onLongPress={
          key === '⌫' ? () => onChange(pressAmountKey(value, 'C')) : undefined
        }
      >
        <Text
          style={[
            styles.keyText,
            (isAmountOperator(key) || key === '=') && styles.keyTextOperator,
            key === '⌫' && styles.keyTextMuted,
          ]}
        >
          {key}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.pad}>
      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.digitBlock}>{row.digits.map(renderKey)}</View>
          <View style={styles.opBlock}>{row.ops.map(renderKey)}</View>
        </View>
      ))}
    </View>
  );
}

const GAP = 7;

const styles = StyleSheet.create({
  pad: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  // Three digit columns against two narrower calculator ones.
  digitBlock: { flex: 9, flexDirection: 'row', gap: GAP },
  opBlock: { flex: 4, flexDirection: 'row', gap: GAP },
  // No boxes: a grid of outlined tiles reads as clutter under a form that
  // is already all bordered fields. The glyph is the key, and pressing one
  // lights a rounded patch under your thumb.
  key: {
    flex: 1,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  keyPressed: { backgroundColor: colors.surface },
  keyText: { fontSize: 28, fontWeight: '500', color: colors.text },
  keyTextOperator: { fontSize: 23, fontWeight: '600', color: colors.accent },
  keyTextMuted: { fontSize: 21, color: colors.textMuted },
  // Save is the one real button down here, so it keeps its fill.
  submitKey: { backgroundColor: colors.accent, borderRadius: 16 },
  submitKeyPressed: { opacity: 0.85 },
  submitKeyText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
