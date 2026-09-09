import { StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';
import { ScreenContainer } from './ScreenContainer';

export function StubScreen({ title }: { title: string }) {
  return (
    <ScreenContainer>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
  },
});
