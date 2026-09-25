import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useFlaggedCount } from '../../hooks/useFlaggedCount';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// The only way into the review page: shown where the problems are, and only
// while there are some.
export function FlaggedBanner() {
  const t = useT();
  const count = useFlaggedCount();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  if (count === 0) return null;
  return (
    <Pressable style={styles.banner} onPress={() => navigation.navigate('FlaggedTransactions')}>
      <Text style={styles.text} numberOfLines={1}>
        {t(count === 1 ? 'review.bannerOne' : 'review.bannerMany', { count })}
      </Text>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.amberTint,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  text: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.amber },
  arrow: { fontSize: 18, color: colors.amber },
});
