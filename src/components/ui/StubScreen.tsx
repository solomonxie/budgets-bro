import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ScreenContainer } from './ScreenContainer';

// Placeholder for a screen still being designed/built.
export function StubScreen({ title }: { title: string }) {
  return (
    <ScreenContainer>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>Coming soon — this screen is still being designed.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
