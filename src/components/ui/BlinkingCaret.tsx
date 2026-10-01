import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

const HALF_PERIOD_MS = 530;

// Hard on/off like a terminal cursor, not a fade. `resetKey` changing (a
// keystroke) shows it solid again before blinking resumes.
export function BlinkingCaret({ style, resetKey }: { style: StyleProp<ViewStyle>; resetKey?: unknown }) {
  const [opacity] = useState(() => new Animated.Value(1));
  const focused = useIsFocused();

  useEffect(() => {
    opacity.setValue(1);
    if (!focused) return;
    const step = (to: number) => Animated.timing(opacity, { toValue: to, duration: 0, useNativeDriver: true });
    const blink = Animated.loop(
      Animated.sequence([Animated.delay(HALF_PERIOD_MS), step(0), Animated.delay(HALF_PERIOD_MS), step(1)]),
    );
    blink.start();
    return () => blink.stop();
  }, [opacity, focused, resetKey]);

  return <Animated.View style={[style, { opacity }]} />;
}
