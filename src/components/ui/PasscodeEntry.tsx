import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PASSCODE_LENGTH } from '../../secure/appLock';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

// Four dots and a keypad — no TextInput, so no keyboard slides over the
// screen and no autofill has an opinion about it. Shared by the lock screen
// and by Settings' "set a passcode" flow, which runs it twice.
export function PasscodeEntry({
  title,
  subtitle,
  error,
  onComplete,
  onCancel,
  cancelLabel,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  onComplete: (passcode: string) => void;
  // Only passed where backing out is a real option — setting a passcode can
  // be abandoned; the lock screen has nowhere to abandon it to.
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [digits, setDigits] = useState('');
  // Held in a ref so the effect below doesn't reschedule itself every time
  // the parent re-renders with a fresh closure.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // A rejected code clears itself, so the next attempt starts on empty
  // rather than needing four backspaces first.
  useEffect(() => {
    if (error) setDigits('');
  }, [error]);

  // Reporting a full code always empties the field first. The same mounted
  // component runs both passes of "set a passcode" — leave the four digits
  // in place and the confirm round has nowhere to type. The short delay is
  // only so the fourth dot is visibly filled before it clears.
  useEffect(() => {
    if (digits.length < PASSCODE_LENGTH) return;
    const code = digits;
    const timer = setTimeout(() => {
      setDigits('');
      onCompleteRef.current(code);
    }, 120);
    return () => clearTimeout(timer);
  }, [digits]);

  const press = (key: string) => {
    if (key === '') return;
    if (key === '⌫') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    setDigits((d) => (d.length >= PASSCODE_LENGTH ? d : d + key));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.dots}>
        {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < digits.length && styles.dotFilled]}
          />
        ))}
      </View>
      <Text style={[styles.error, !error && styles.errorHidden]}>
        {error ?? ' '}
      </Text>
      <View style={styles.keypad}>
        {KEYS.map((key, i) => (
          <Pressable
            key={i}
            disabled={key === ''}
            style={[styles.key, key === '' && styles.keyBlank]}
            onPress={() => press(key)}
          >
            <Text style={styles.keyText}>{key}</Text>
          </Pressable>
        ))}
      </View>
      {onCancel ? (
        <Pressable hitSlop={8} onPress={onCancel}>
          <Text style={styles.cancel}>{cancelLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  dots: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  dotFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
  error: { fontSize: 13, color: colors.negative },
  // Holds its line whether or not there's an error, so the keypad never
  // jumps a row up and down under the thumb.
  errorHidden: { opacity: 0 },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 3 * 84,
  },
  key: {
    width: 84,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBlank: { opacity: 0 },
  keyText: { fontSize: 26, color: colors.text },
  cancel: { fontSize: 15, fontWeight: '700', color: colors.accent },
});
