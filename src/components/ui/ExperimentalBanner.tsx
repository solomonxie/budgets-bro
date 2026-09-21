import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Sits above a page's own guide text, on the pages whose numbers aren't
// finished being argued with yet. Amber rather than red: nothing here is
// broken, it is just not done.
export function ExperimentalBanner() {
  const t = useT();
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{t('common.experimental')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.amberTint,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  text: { fontSize: 13, lineHeight: 18, color: colors.amber },
});
