import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { InfoButton } from '../../components/ui/InfoButton';
import { useBackupHealth } from '../../hooks/useBackupHealth';
import { getDb } from '../../db/client';
import { syncNow } from '../../sync/cloudSync';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { relativeTime } from './BackupSection';

// "Is my data safe, and how do I get it back?" answered at the top of
// Settings: the live state of the off-device copy, a way to make one now,
// and the whole story one tap away.
export function DataSafetyRow() {
  const t = useT();
  const [health, refresh] = useBackupHealth();
  const [backingUp, setBackingUp] = useState(false);
  const [failed, setFailed] = useState(false);

  const backUpNow = async () => {
    setBackingUp(true);
    setFailed(false);
    try {
      const outcomes = await syncNow(await getDb());
      setFailed(outcomes.length === 0 || outcomes.every((o) => o.error != null));
    } finally {
      setBackingUp(false);
      await refresh();
    }
  };

  const status =
    health == null
      ? ''
      : failed
        ? t('dataSafety.failed')
        : health.kind === 'none'
          ? t('dataSafety.none')
          : t(health.kind === 'ok' ? 'dataSafety.ok' : 'dataSafety.stale', {
              where: health.destinations.join(', '),
              when: relativeTime(health.lastSyncedAt, t),
            });
  const warn = failed || (health != null && health.kind !== 'ok');

  return (
    <View style={[styles.row, styles.divider]}>
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('dataSafety.title')}</Text>
          <InfoButton
            title={t('dataSafety.infoTitle')}
            paragraphs={[
              t('dataSafety.infoWhere'),
              t('dataSafety.infoLayers'),
              t('dataSafety.infoReinstall'),
              t('dataSafety.infoMistake'),
              t('dataSafety.infoOpen'),
              t('dataSafety.infoPhoneBackup'),
            ]}
            closeLabel={t('common.done')}
          />
        </View>
        <Text style={[styles.status, warn && styles.warn]}>{status}</Text>
      </View>
      {health != null && health.kind !== 'none' ? (
        <Pressable hitSlop={8} onPress={backUpNow} disabled={backingUp}>
          {backingUp ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.action}>{t('dataSafety.backUpNow')}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  main: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 15, color: colors.text },
  status: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  warn: { color: colors.amber },
  action: { fontSize: 14, fontWeight: '700', color: colors.accent },
});
