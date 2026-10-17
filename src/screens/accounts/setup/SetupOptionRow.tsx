import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { CheckCircle } from './CheckCircle';

// A whole-width card per answer: big enough to hit without looking, with
// the glyph doing the recognising before the label is read.
export function SetupOptionRow({
  glyph,
  glyphIsText,
  label,
  sub,
  picked,
  multi,
  onPress,
}: {
  glyph: string;
  glyphIsText?: boolean;
  label: string;
  sub?: string;
  picked: boolean;
  multi: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        picked && styles.rowPicked,
        pressed && styles.pressed,
      ]}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: picked }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
    >
      <View style={[styles.glyphWrap, picked && styles.glyphWrapPicked]}>
        <Text style={glyphIsText ? styles.glyphText : styles.glyph}>{glyph}</Text>
      </View>
      <View style={styles.main}>
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {multi ? (
        <CheckCircle on={picked} />
      ) : picked ? (
        <Text style={styles.chosen}>✓</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowPicked: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(45,212,191,0.08)',
  },
  pressed: { opacity: 0.7 },
  glyphWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  glyphWrapPicked: { backgroundColor: 'rgba(45,212,191,0.16)' },
  glyph: { fontSize: 22 },
  glyphText: { fontSize: 16, fontWeight: '700', color: colors.text },
  main: { flex: 1, gap: 2 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, lineHeight: 17, color: colors.textMuted },
  chosen: { color: colors.accent, fontSize: 18, fontWeight: '800' },
});
