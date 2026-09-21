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
const LEFT = 'bottomLeft';
const RIGHT = 'bottomRight';
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
  // The bottom row's two spare slots, either side of the 0. A pad that edits
  // something which already has a value (a category's assignment) needs more
  // than "save": a way to throw away what you just typed, and a way through
  // to what the figure is made of. Both belong under the thumb that is
  // already here, in the grid the rest of the keys line up to — not squeezed
  // into the operator column, which is two-fifths as wide.
  bottomLeft?: { label: string; onPress: () => void };
  bottomRight?: { label: string; onPress: () => void };
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
  bottomLeft,
  bottomRight,
}: NumberPadProps) {
  // Submit keeps the whole operator column to itself, so it stays the widest
  // key on the pad however many words sit beside the 0.
  const rows =
    bottomLeft || bottomRight
      ? ROWS.map((row, i) =>
          i === ROWS.length - 1
            ? {
                ...row,
                digits: [
                  ...(bottomLeft ? [LEFT] : []),
                  '0',
                  ...(bottomRight ? [RIGHT] : []),
                ],
              }
            : row,
        )
      : ROWS;

  const renderKey = (key: AmountKey) => {
    if (key === LEFT || key === RIGHT) {
      const action = key === LEFT ? bottomLeft! : bottomRight!;
      return (
        <Pressable
          key={key}
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          onPress={action.onPress}
        >
          <Text style={styles.wordKeyText} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      );
    }
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
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.digitBlock}>{row.digits.map(renderKey)}</View>
          <View style={styles.opBlock}>{row.ops.map(renderKey)}</View>
        </View>
      ))}
    </View>
  );
}

const GAP = 6;

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
    // 52, not 60: with a Purchase items row on the spend form the pad was
    // being pushed half off the bottom of a 14-sized screen. Still well over
    // the 44pt a thumb needs.
    height: 52,
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
  // No box of their own: they are keys of the same grid as the digits, and
  // outlining them made two odd little buttons floating in a row of plain
  // glyphs. Both stay muted — Save is the one thing down here that should
  // pull the eye, and a second tinted word beside it made the bottom row
  // read as three competing buttons.
  wordKeyText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
