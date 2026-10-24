import { useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CalcField } from '../useCalcField';
import { useScrollLock } from '../../../components/ui/scrollLock';
import { formatMoney } from '../../../domain/money';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

export type SliderKind = 'money' | 'percent' | 'number';

// Evenly spaced values, from..to inclusive.
export function steps(from: number, to: number, by: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + by / 1000; v += by)
    out.push(Number(v.toFixed(4)));
  return out;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function nearestIndex(stops: number[], value: number): number {
  let best = 0;
  for (let i = 1; i < stops.length; i++)
    if (Math.abs(stops[i] - value) < Math.abs(stops[best] - value)) best = i;
  return best;
}

function readField(field: CalcField, kind: SliderKind): number {
  return kind === 'money' ? field.cents / 100 : field.number;
}

function toText(n: number, kind: SliderKind): string {
  return kind === 'money'
    ? Math.round(n).toLocaleString('en-US')
    : String(Number(n.toFixed(2)));
}

export function formatSlider(
  n: number,
  kind: SliderKind,
  unit?: string,
): string {
  if (kind === 'money') return formatMoney(Math.round(n * 100));
  const text = String(Number(n.toFixed(2)));
  return kind === 'percent' ? `${text}%` : unit ? `${text} ${unit}` : text;
}

// Slide for the number, tap the number to type it exactly. The value
// changes as the finger moves, so the page's figures follow the thumb.
export function SliderField({
  label,
  field,
  kind,
  stops: fixedStops,
  around,
  empty,
  unit,
  hint,
  display,
}: {
  label: string;
  field: CalcField;
  kind: SliderKind;
  stops?: number[];
  /**
   * Instead of fixed stops: half to double the value it started at, in
   * steps of this size. Typing a number outside that re-centres it there.
   */
  around?: number;
  /** Where the thumb rests while the field is blank. */
  empty?: number;
  unit?: string;
  hint?: string;
  /** Overrides the value text, e.g. "20% · $160,000". */
  display?: string;
}) {
  const value = field.filled ? readField(field, kind) : null;
  const [typing, setTyping] = useState(false);
  const [anchor, setAnchor] = useState(value || empty || 0);
  const lo = around ? Math.max(around, roundTo(anchor / 2, around)) : 0;
  const hi = around ? Math.max(lo + around, roundTo(anchor * 2, around)) : 0;
  if (around && value != null && value > 0 && (value < lo || value > hi))
    setAnchor(value);
  const stops = fixedStops ?? steps(lo, hi, around ?? 1);
  const index = nearestIndex(stops, value ?? empty ?? stops[0]);
  const ratio = stops.length > 1 ? index / (stops.length - 1) : 0;
  const commit = (i: number) => field.set(toText(stops[i], kind));

  return (
    <View style={styles.wrap}>
      {label ? (
        <View style={styles.head}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {typing ? (
            <TextInput
              style={[styles.value, styles.input]}
              value={field.text}
              onChangeText={(text) =>
                field.set(
                  kind === 'money'
                    ? text.replace(/\D/g, '')
                      ? Number(text.replace(/\D/g, '')).toLocaleString('en-US')
                      : ''
                    : text,
                )
              }
              keyboardType={kind === 'money' ? 'number-pad' : 'decimal-pad'}
              keyboardAppearance="dark"
              autoFocus
              selectTextOnFocus
              onBlur={() => setTyping(false)}
              returnKeyType="done"
            />
          ) : (
            <Pressable
              style={styles.editable}
              hitSlop={8}
              onPress={() => setTyping(true)}
            >
              <Text style={[styles.value, value == null && styles.blank]}>
                {display ??
                  (value == null ? '—' : formatSlider(value, kind, unit))}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
      <Track
        ratio={ratio}
        dim={value == null}
        count={stops.length}
        onDrag={commit}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Track({
  ratio,
  dim,
  count,
  onDrag,
}: {
  ratio: number;
  dim: boolean;
  count: number;
  onDrag: (index: number) => void;
}) {
  const lockScroll = useScrollLock();
  // Only ever touched inside the handlers below, never during render.
  const gesture = useRef({ width: 0, left: 0, offset: 0, last: -1 });
  const span = () => Math.max(1, gesture.current.width - THUMB);
  const thumbX = () => THUMB / 2 + ratio * span();
  const move = (pageX: number) => {
    const g = gesture.current;
    const x = pageX - g.left - g.offset - THUMB / 2;
    const i = Math.round(Math.min(1, Math.max(0, x / span())) * (count - 1));
    if (i !== g.last) {
      g.last = i;
      onDrag(i);
    }
  };
  const end = () => lockScroll(false);
  // Only a finger that lands on the dot moves it — brushing the bar on the
  // way down the page scrolls as usual. Once held, the page stays still
  // until the finger lifts.
  const handlers = {
    onStartShouldSetResponder: (e: GestureResponderEvent) =>
      Math.abs(e.nativeEvent.locationX - thumbX()) <= GRAB,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      lockScroll(true);
      const g = gesture.current;
      g.left = e.nativeEvent.pageX - e.nativeEvent.locationX;
      g.offset = e.nativeEvent.locationX - thumbX();
      g.last = -1;
    },
    onResponderMove: (e: GestureResponderEvent) => move(e.nativeEvent.pageX),
    onResponderRelease: end,
    onResponderTerminate: end,
  };

  return (
    <View
      style={styles.track}
      onLayout={(e) => {
        gesture.current.width = e.nativeEvent.layout.width;
      }}
      {...handlers}
    >
      <View pointerEvents="none" style={styles.inset}>
        <View style={styles.rail}>
          <View
            style={[
              styles.fill,
              { width: `${ratio * 100}%` },
              dim && styles.fillDim,
            ]}
          />
        </View>
        <View
          style={[
            styles.thumb,
            { left: `${ratio * 100}%` },
            dim && styles.thumbDim,
          ]}
        />
      </View>
    </View>
  );
}

const THUMB = 26;
// How far from the dot's centre a finger still counts as holding it.
const GRAB = 26;

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1, fontSize: 14, color: colors.textMuted },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    minWidth: 64,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  blank: { color: colors.textMuted },
  // Underlined like a field, so the number reads as tappable to type.
  editable: {
    paddingBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.textMuted,
  },
  input: {
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
  },
  track: { height: 40, justifyContent: 'center' },
  inset: { marginHorizontal: THUMB / 2, justifyContent: 'center' },
  rail: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: 4, backgroundColor: colors.accent },
  fillDim: { backgroundColor: colors.textMuted, opacity: 0.4 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    marginLeft: -THUMB / 2,
    borderRadius: THUMB / 2,
    backgroundColor: colors.text,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  thumbDim: { borderColor: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
