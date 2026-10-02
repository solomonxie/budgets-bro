import { useLayoutEffect, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
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
          style={({ pressed }) => [styles.key, styles.spaced, pressed && styles.keyPressed]}
          hitSlop={GAP / 2}
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
          hitSlop={GAP / 2}
          style={({ pressed }) => [
            styles.spaced,
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
      <TapKey
        key={key}
        label={key}
        short={short}
        onTap={() => press(key)}
        // No C key — holding backspace wipes the whole amount, which is the
        // only time anyone reached for it.
        onHold={key === '⌫' ? () => press('C') : undefined}
      />
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

// Pressable lets one touch be the responder at a time, so a thumb landing
// before the last one lifted was dropped. Raw touch events reach every key
// under every finger. The key fills its cell, gap included: no dead space.
function TapKey({
  label,
  short,
  onTap,
  onHold,
}: {
  label: AmountKey;
  short: boolean;
  onTap: () => void;
  onHold?: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const begin = (e: GestureResponderEvent) => {
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    setPressed(true);
    if (onHold)
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        start.current = null;
        onHold();
      }, 500);
  };
  const end = (e: GestureResponderEvent) => {
    const from = start.current;
    const held = onHold && !holdTimer.current;
    clearHold();
    start.current = null;
    setPressed(false);
    if (!from || held) return;
    const { pageX, pageY } = e.nativeEvent;
    if (Math.abs(pageX - from.x) < 30 && Math.abs(pageY - from.y) < 30) onTap();
  };
  const cancel = () => {
    clearHold();
    start.current = null;
    setPressed(false);
  };
  return (
    <View
      style={[styles.cell, short && styles.shortCell]}
      onTouchStart={begin}
      onTouchEnd={end}
      onTouchCancel={cancel}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onAccessibilityTap={onTap}
    >
      <View
        style={[styles.key, short && styles.shortKey, pressed && styles.keyPressed]}
      >
        <Text
          style={[
            styles.keyText,
            (isAmountOperator(label) || label === '=') && styles.keyTextOperator,
            label === '⌫' && styles.keyTextMuted,
            short && styles.keyTextShort,
          ]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

const GAP = 6;
const KEY_HEIGHT = 54;
const SAVE_HEIGHT = 58;

const styles = StyleSheet.create({
  // Gaps live inside each cell as padding, so every point is some key's.
  pad: { flexDirection: 'row', margin: -GAP / 2 },
  row: { flexDirection: 'row' },
  // Three digit columns against two narrower calculator ones.
  digitBlock: { flex: 9 },
  opBlock: { flex: 4 },
  shortRow: { flex: 1 },
  submitRow: { flexDirection: 'row', height: KEY_HEIGHT + GAP },
  tallSubmit: { height: SAVE_HEIGHT + GAP },
  cell: { flex: 1, padding: GAP / 2 },
  shortCell: { height: '100%' },
  spaced: { flex: 1, margin: GAP / 2 },
  // No boxes: a grid of outlined tiles reads as clutter under a form that
  // is already all bordered fields. The glyph is the key, and pressing one
  // lights a rounded patch under your thumb.
  key: {
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
    justifyContent: 'center',
    alignItems: 'center',
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
