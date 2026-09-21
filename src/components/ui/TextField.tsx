import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors } from '../../theme/colors';

interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  // Sits beside the label — an ⓘ for a field whose meaning takes a
  // paragraph, which a one-line hint can't carry.
  info?: ReactNode;
}

// keyboardAppearance="dark" — the app is dark-only for now (see
// theme/colors.ts), but the system keyboard doesn't follow that on its own;
// override via props if/when a light theme ships.
export function TextField({ label, hint, info, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {info}
        </View>
      ) : null}
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.textMuted} keyboardAppearance="dark" {...props} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
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
});
