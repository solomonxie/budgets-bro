import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useBackupHealth } from '../../hooks/useBackupHealth';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Silent while backups work. Only when changes have gone days without
// reaching an off-device copy — or there is nowhere off-device at all — does
// it say so, where it will be seen, and lead to the fix.
export function BackupBanner() {
  const t = useT();
  const [health] = useBackupHealth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  if (health == null || health.kind === 'ok') return null;
  if (health.kind === 'none' && !health.hasData) return null;

  const text =
    health.kind === 'none'
      ? t('backupBanner.none')
      : health.daysSince == null
        ? t('backupBanner.never')
        : t('backupBanner.stale', { count: health.daysSince });

  return (
    <Pressable style={styles.banner} onPress={() => navigation.navigate('Settings')}>
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
      <Text style={styles.fix}>{t('backupBanner.fix')}</Text>
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
  fix: { fontSize: 14, fontWeight: '700', color: colors.amber },
});
