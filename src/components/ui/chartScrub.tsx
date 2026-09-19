import { useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Circle, Line } from 'react-native-svg';
import { colors } from '../../theme/colors';

// How long a finger has to stay put before a chart reads it as "show me
// this step" rather than "scroll". Short enough not to feel like a wait,
// long enough that a flick still scrolls.
const HOLD_MS = 140;
const SLOP = 6;

// Reading a chart with a finger, for every chart that scrolls: tap a step
// to read it, or hold a moment and slide to sweep along it, and it stays
// where the finger lifts.
//
// Hold-then-slide because the same horizontal drag also scrolls the chart —
// a flick scrolls, a finger that stays put starts reading, and once it is
// reading the scroll view is refused the gesture until it lifts (hence
// `scrollEnabled`, which the caller hands to its ScrollView).
//
// Raw responder props rather than PanResponder: the handlers are plain
// props, so the gesture's own state can live in a ref that is only ever
// touched inside them.
export function useChartScrub({
  count,
  chartWidth,
  onSelect,
}: {
  count: number;
  chartWidth: number;
  onSelect: (index: number | null) => void;
}) {
  const [scrollEnabled, setScrollEnabled] = useState(true);
  // Only ever touched inside the handlers below, never during render.
  const state = useRef({
    scrubbing: false,
    holdTimer: null as ReturnType<typeof setTimeout> | null,
    startX: 0,
    startY: 0,
  });

  const indexAt = (x: number) => {
    if (count < 2) return 0;
    const i = Math.round((x / chartWidth) * (count - 1));
    return Math.min(count - 1, Math.max(0, i));
  };
  const cancelHold = () => {
    const gesture = state.current;
    if (gesture.holdTimer) clearTimeout(gesture.holdTimer);
    gesture.holdTimer = null;
  };
  const endGesture = () => {
    cancelHold();
    state.current.scrubbing = false;
    setScrollEnabled(true);
  };
  const moved = (e: GestureResponderEvent) =>
    Math.abs(e.nativeEvent.pageX - state.current.startX) > SLOP ||
    Math.abs(e.nativeEvent.pageY - state.current.startY) > SLOP;

  return {
    scrollEnabled,
    handlers: {
      onStartShouldSetResponder: () => true,
      onResponderTerminationRequest: () => !state.current.scrubbing,
      onResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, pageX, pageY } = e.nativeEvent;
        const gesture = state.current;
        gesture.startX = pageX;
        gesture.startY = pageY;
        gesture.holdTimer = setTimeout(() => {
          gesture.scrubbing = true;
          setScrollEnabled(false);
          onSelect(indexAt(locationX));
        }, HOLD_MS);
      },
      onResponderMove: (e: GestureResponderEvent) => {
        if (state.current.scrubbing) {
          onSelect(indexAt(e.nativeEvent.locationX));
          return;
        }
        // Moved before the hold landed: this was a scroll all along.
        if (moved(e)) cancelHold();
      },
      onResponderRelease: (e: GestureResponderEvent) => {
        const tapped = !state.current.scrubbing && !moved(e);
        const x = e.nativeEvent.locationX;
        endGesture();
        if (tapped) onSelect(indexAt(x));
      },
      onResponderTerminate: endGesture,
    },
  };
}

// Where the finger is: a full-height rule through the step being read, and
// a dot on the line itself. Drawn inside the chart's own <Svg>.
export function ScrubMarker({
  x,
  y,
  height,
  color = colors.accent,
}: {
  x: number;
  y?: number;
  height: number;
  color?: string;
}) {
  return (
    <>
      <Line
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={colors.textMuted}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {y != null ? <Circle cx={x} cy={y} r={4} fill={color} /> : null}
    </>
  );
}
