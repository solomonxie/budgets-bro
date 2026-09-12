import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors } from '../../theme/colors';

interface TextFieldProps extends TextInputProps {
  label?: string;
}

// keyboardAppearance="dark" — the app is dark-only for now (see
// theme/colors.ts), but the system keyboard doesn't follow that on its own;
// override via props if/when a light theme ships.
export function TextField({ label, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.textMuted} keyboardAppearance="dark" {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
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
