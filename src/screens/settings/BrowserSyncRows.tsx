import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { relativeTime } from '../../i18n/relativeTime';
import { useT } from '../../i18n';
import type { BrowserSyncStatus } from '../../sync/browserSync';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// The indented sub-rows under an S3 bucket in Settings › Backup
// (docs/design/browser-sync/uiux/sync.md). One bucket is the sync home.
export interface BrowserSyncView {
  demo: boolean;
  status: BrowserSyncStatus | null;
  homeBucket: string | null;
  deviceCount: number;
  conflictCount: number;
}

interface Props {
  configId: string;
  view: BrowserSyncView;
  onToggle: (next: boolean) => void;
  onSyncNow: () => void;
  onOpenDevices: () => void;
  onOpenConflicts: () => void;
}

type T = ReturnType<typeof useT>;

export function syncSubtitle(
  view: BrowserSyncView,
  configId: string,
  t: T,
): { text: string; error: boolean } {
  const s = view.status;
  if (view.demo) return { text: t('browserSync.demo'), error: false };
  if (s?.enabled && s.homeConfig && s.homeConfig !== configId) {
    return { text: t('browserSync.otherBucket', { bucket: view.homeBucket ?? '' }), error: false };
  }
  if (!s?.enabled || s.homeConfig !== configId) return { text: t('browserSync.offHint'), error: false };
  if (s.fatal?.kind === 'newer') return { text: t('browserSync.stopped'), error: true };
  if (s.fatal) return { text: s.fatal.detail, error: true };
  if (s.error?.kind === 'offline') return { text: t('browserSync.offline'), error: false };
  if (s.error) return { text: s.error.detail, error: true };
  if (s.lastSynced == null) return { text: t('browserSync.publishing', { count: s.pending }), error: false };
  if (s.pending > 0) return { text: t('browserSync.waiting', { count: s.pending }), error: false };
  return {
    text: t('browserSync.synced', { time: relativeTime(new Date(s.lastSynced).toISOString(), t) }),
    error: false,
  };
}

export function BrowserSyncRows({ configId, view, onToggle, onSyncNow, onOpenDevices, onOpenConflicts }: Props) {
  const t = useT();
  const s = view.status;
  const home = !!s?.enabled && s.homeConfig === configId;
  const elsewhere = !!s?.enabled && !!s.homeConfig && s.homeConfig !== configId;
  const subtitle = syncSubtitle(view, configId, t);

  return (
    <>
      <View style={[styles.row, styles.divider]}>
        <Pressable
          style={styles.main}
          disabled={!home}
          onPress={onSyncNow}
          accessibilityLabel={home ? t('browserSync.syncNow') : undefined}
        >
          <Text style={[styles.title, (view.demo || elsewhere) && styles.titleOff]}>
            {t('browserSync.toggle')}
          </Text>
          <Text style={[styles.subtitle, subtitle.error && styles.error]} numberOfLines={2}>
            {subtitle.text}
          </Text>
        </Pressable>
        <Switch value={home && !view.demo} disabled={view.demo || elsewhere} onValueChange={onToggle} />
      </View>
      {home && !view.demo ? (
        <Pressable style={[styles.row, styles.divider]} onPress={onOpenDevices}>
          <Text style={[styles.title, styles.main]}>{t('browserSync.devices')}</Text>
          <Text style={styles.count}>{view.deviceCount}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}
      {home && !view.demo && view.conflictCount > 0 ? (
        <Pressable style={[styles.row, styles.divider]} onPress={onOpenConflicts}>
          <Text style={[styles.title, styles.main]}>{t('browserSync.conflicts')}</Text>
          <Text style={styles.count}>{view.conflictCount}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingLeft: spacing.md + spacing.lg,
    paddingRight: spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  main: { flex: 1, gap: 2 },
  title: { fontSize: 15, color: colors.text },
  titleOff: { color: colors.textMuted },
  subtitle: { fontSize: 12, color: colors.textMuted },
  error: { color: colors.negative },
  count: { fontSize: 15, color: colors.textMuted },
  chevron: { fontSize: 18, color: colors.textMuted },
});
