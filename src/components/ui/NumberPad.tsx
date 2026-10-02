import { useLayoutEffect, useRef } from 'react';
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
const BLANK = 'blank';

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
  // Taps faster than the form re-renders would each start from the same
  // stale `value` and overwrite one another; this tracks every press.
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  }, [value]);
  const press = (key: AmountKey) => {
    latest.current = pressAmountKey(latest.current, key);
    onChange(latest.current);
  };
  // 0 sits under 8, phone-keypad style, with ⌫ to its right — unless that
  // slot holds a word, which sends ⌫ back up beside the =.
  const digitRows: AmountKey[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [bottomLeft ? LEFT : BLANK, '0', bottomRight ? RIGHT : '⌫'],
  ];
  // Alone in its row, = gives Save a few points of its height: a short bar
  // over a slightly taller Save, where the thumb ends up.
  const lastOps: AmountKey[] = bottomRight ? ['=', '⌫'] : ['='];

  const renderKey = (key: AmountKey, short = false) => {
    if (key === BLANK) return <View key={key} style={styles.key} />;
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
        style={({ pressed }) => [
          styles.key,
          short && styles.shortKey,
          pressed && styles.keyPressed,
        ]}
        onPress={() => press(key)}
        // No C key — holding backspace wipes the whole amount, which is the
        // only time anyone reached for it.
        onLongPress={
          key === '⌫' ? () => press('C') : undefined
        }
      >
        <Text
          style={[
            styles.keyText,
            (isAmountOperator(key) || key === '=') && styles.keyTextOperator,
            key === '⌫' && styles.keyTextMuted,
            short && styles.keyTextShort,
          ]}
        >
          {key}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.pad}>
      <View style={styles.digitBlock}>
        {digitRows.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((key) => renderKey(key))}
          </View>
        ))}
      </View>
      <View style={styles.opBlock}>
        <View style={styles.row}>
          {(['÷', '×'] as const).map((k) => renderKey(k))}
        </View>
        <View style={styles.row}>
          {(['−', '+'] as const).map((k) => renderKey(k))}
        </View>
        <View style={[styles.row, lastOps.length === 1 && styles.shortRow]}>
          {lastOps.map((k) => renderKey(k, lastOps.length === 1))}
        </View>
        <View
          style={[styles.submitRow, lastOps.length === 1 && styles.tallSubmit]}
        >
          {renderKey(SUBMIT)}
        </View>
      </View>
    </View>
  );
}

const GAP = 6;
const KEY_HEIGHT = 54;
const SAVE_HEIGHT = 58;

const styles = StyleSheet.create({
  pad: { flexDirection: 'row', gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  // Three digit columns against two narrower calculator ones.
  digitBlock: { flex: 9, gap: GAP },
  opBlock: { flex: 4, gap: GAP },
  shortRow: { flex: 1 },
  submitRow: { flexDirection: 'row', height: KEY_HEIGHT },
  tallSubmit: { height: SAVE_HEIGHT },
  // No boxes: a grid of outlined tiles reads as clutter under a form that
  // is already all bordered fields. The glyph is the key, and pressing one
  // lights a rounded patch under your thumb.
  key: {
    flex: 1,
    // Not 60: with a Purchase items row on the spend form the pad was being
    // pushed half off the bottom of a 14-sized screen.
    height: KEY_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  shortKey: { height: '100%' },
  keyPressed: { backgroundColor: colors.surface },
  keyText: { fontSize: 40, fontWeight: '500', color: colors.text },
  keyTextShort: { fontSize: 20, fontWeight: '500' },
  keyTextOperator: { fontSize: 23, fontWeight: '600', color: colors.accent },
  keyTextMuted: { fontSize: 22, color: colors.textMuted },
  // Save is the one real button down here, so it keeps its fill.
  submitKey: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 16,
  },
  submitKeyPressed: { opacity: 0.85 },
  submitKeyText: { fontSize: 19, fontWeight: '700', color: '#fff' },
  // No box of their own: they are keys of the same grid as the digits, and
  // outlining them made two odd little buttons floating in a row of plain
  // glyphs. Both stay muted — Save is the one thing down here that should
  // pull the eye, and a second tinted word beside it made the bottom row
  // read as three competing buttons.
  wordKeyText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
