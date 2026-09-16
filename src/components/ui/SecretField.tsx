import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';

interface SecretFieldProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  // The credential's usual length. A mismatch is reported as a hint, never
  // as a blocked save — vendors change formats, and a wrong guess here must
  // not stop someone entering a key that actually works.
  expectedLength?: number;
}

// A credential you type or paste. The failure mode is invisible: iOS
// autocorrect and smart quotes turn a 20-character key into 19 characters and
// a curly quote, and the service answers with a signature error that reads
// like bad credentials rather than bad text input. So: correction off,
// spellcheck off, no capitalization, a show/hide eye because a masked field
// can't be proofread, and the character count under it.
export function SecretField({ label, value, onChangeText, expectedLength, style, ...props }: SecretFieldProps) {
  const t = useT();
  const [revealed, setRevealed] = useState(false);
  const lengthMismatch = expectedLength != null && value.length > 0 && value.length !== expectedLength;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Pressable onPress={() => setRevealed((on) => !on)} hitSlop={8}>
          <Text style={styles.reveal}>{revealed ? t('common.hide') : t('common.show')}</Text>
        </Pressable>
      </View>
      <TextInput
        style={[styles.input, style]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!revealed}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        placeholderTextColor={colors.textMuted}
        keyboardAppearance="dark"
        {...props}
      />
      {lengthMismatch ? (
        <Text style={styles.warning}>{t('common.secretLengthHint', { count: value.length, expected: expectedLength! })}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, flexShrink: 1 },
  reveal: { fontSize: 13, fontWeight: '600', color: colors.accent },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  warning: { fontSize: 12, color: colors.amber },
});
