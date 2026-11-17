import { useLayoutEffect, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AmountExpression,
  AmountKey,
  AmountScale,
  isAmountOperator,
  pressAmountKey,
} from '../../domain/amountExpression';
import { colors } from '../../theme/colors';

// One 4×4 grid of equal keys: digits in phone-keypad order, then ⌫, −, +
// and the submit key down the right. The sum is evaluated on submit, so
// there is no separate = key.
const SUBMIT = 'submit';
const LEFT = 'bottomLeft';
const RIGHT = 'bottomRight';
const BLANK = 'blank';

interface NumberPadProps {
  value: AmountExpression;
  onChange: (next: AmountExpression) => void;
  submitLabel: string;
  onSubmit: () => void;
  // The bottom row's spare slots either side of the 0. Left falls back to
  // 00, right to nothing.
  bottomLeft?: { label: string; onPress: () => void };
  bottomRight?: { label: string; onPress: () => void };
  // A converter has nothing to save: the submit key is = itself.
  equalsAsSubmit?: boolean;
  // Shorter keys and lighter glyphs, for a page where the pad shares the
  // screen with content rather than finishing a form.
  compact?: boolean;
  scale?: AmountScale;
}

export function NumberPad({
  value,
  onChange,
  submitLabel,
  onSubmit,
  bottomLeft,
  bottomRight,
  equalsAsSubmit,
  compact = false,
  scale = 1,
}: NumberPadProps) {
  // Taps faster than the form re-renders would each start from the same
  // stale `value` and overwrite one another; this tracks every press.
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  }, [value]);
  const press = (key: AmountKey) => {
    latest.current = pressAmountKey(latest.current, key, scale);
    onChange(latest.current);
  };
  const rows: AmountKey[][] = [
    ['1', '2', '3', '⌫'],
    ['4', '5', '6', '−'],
    ['7', '8', '9', '+'],
    [bottomLeft ? LEFT : '00', '0', bottomRight ? RIGHT : BLANK, SUBMIT],
  ];

  const renderKey = (key: AmountKey) => {
    if (key === BLANK)
      return <View key={key} style={styles.cell} />;
    if (key === LEFT || key === RIGHT) {
      const action = key === LEFT ? bottomLeft! : bottomRight!;
      return (
        <Pressable
          key={key}
          style={({ pressed }) => [
            styles.key,
            compact && styles.keyCompact,
            styles.spaced,
            pressed && styles.keyPressed,
          ]}
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
            compact && styles.keyCompact,
            equalsAsSubmit && styles.equalsKey,
            pressed &&
              (equalsAsSubmit
                ? styles.equalsKeyPressed
                : styles.submitKeyPressed),
          ]}
          onPress={equalsAsSubmit ? () => press('=') : onSubmit}
        >
          <Text
            style={[
              styles.submitKeyText,
              equalsAsSubmit && styles.equalsKeyText,
            ]}
            numberOfLines={1}
          >
            {equalsAsSubmit ? '=' : submitLabel}
          </Text>
        </Pressable>
      );
    return (
      <TapKey
        key={key}
        label={key}
        compact={compact}
        onTap={() => press(key)}
        // No C key — holding backspace wipes the whole amount.
        onHold={key === '⌫' ? () => press('C') : undefined}
      />
    );
  };

  return (
    <View style={styles.pad}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map(renderKey)}
        </View>
      ))}
    </View>
  );
}

// Pressable lets one touch be the responder at a time, so a thumb landing
// before the last one lifted was dropped. Raw touch events reach every key
// under every finger. The key fills its cell, gap included: no dead space.
function TapKey({
  label,
  compact,
  onTap,
  onHold,
}: {
  label: AmountKey;
  compact: boolean;
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
      style={styles.cell}
      onTouchStart={begin}
      onTouchEnd={end}
      onTouchCancel={cancel}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onAccessibilityTap={onTap}
    >
      <View
        style={[
          styles.key,
          compact && styles.keyCompact,
          pressed && styles.keyPressed,
        ]}
      >
        <Text
          style={[
            styles.keyText,
            isAmountOperator(label) && styles.keyTextOperator,
            compact && styles.keyTextCompact,
            compact && isAmountOperator(label) && styles.keyTextOperatorCompact,
            label === '⌫' && styles.keyTextMuted,
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
const COMPACT_KEY_HEIGHT = 48;

const styles = StyleSheet.create({
  // Gaps live inside each cell as padding, so every point is some key's.
  pad: { margin: -GAP / 2 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, padding: GAP / 2 },
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
  keyCompact: { height: COMPACT_KEY_HEIGHT, borderRadius: 12 },
  keyPressed: { backgroundColor: colors.surface },
  keyText: { fontSize: 40, fontWeight: '500', color: colors.text },
  keyTextOperator: { fontSize: 23, fontWeight: '600', color: colors.accent },
  keyTextMuted: { fontSize: 22, color: colors.textMuted },
  // Save is the one real button down here, so it keeps its fill.
  submitKey: {
    justifyContent: 'center',
    alignItems: 'center',
    height: KEY_HEIGHT,
    backgroundColor: colors.accent,
    borderRadius: 16,
  },
  submitKeyPressed: { opacity: 0.85 },
  submitKeyText: { fontSize: 19, fontWeight: '700', color: '#fff' },
  // A glyph like its neighbours, not a block: the result key, not a commit
  // button. It only lights up under the thumb.
  equalsKey: { backgroundColor: 'transparent', borderRadius: 12 },
  equalsKeyPressed: { backgroundColor: colors.surface },
  equalsKeyText: { fontSize: 34, fontWeight: '500', color: colors.accent },
  keyTextCompact: { fontSize: 32, fontWeight: '400' },
  keyTextOperatorCompact: { fontSize: 26, fontWeight: '500' },
  // No box of their own: they are keys of the same grid as the digits, and
  // outlining them made two odd little buttons floating in a row of plain
  // glyphs. Both stay muted — Save is the one thing down here that should
  // pull the eye, and a second tinted word beside it made the bottom row
  // read as three competing buttons.
  wordKeyText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
