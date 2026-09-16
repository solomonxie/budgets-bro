import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import type { MenuItem } from '../../components/ui/RowMenuButton';
import { S3ConfigModal } from '../../components/ui/S3ConfigModal';
import { S3BrowserModal } from '../../components/ui/S3BrowserModal';
import { getDb } from '../../db/client';
import { addS3Config, listS3Configs, removeS3Config } from '../../sync/s3Provider';
import type { S3ConfigInput, S3ConfigMeta } from '../../sync/s3Provider';
import { isLocalBackupEnabled, setLocalBackupEnabled } from '../../sync/localProvider';
import { downloadLatestBackup, getLastSyncedAt, isAutoSyncEnabled, setAutoSyncEnabled, syncNow } from '../../sync/cloudSync';
import { parseBackupZip } from '../../sync/parseBackupZip';
import { importAppExport } from '../../import/appExportImporter';
import type { AppExportImportResult } from '../../import/appExportImporter';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const LOCAL_PROVIDER_ID = 'local';

// Everything a destination needs to render one row and one menu. Local and S3
// differ only in whether the row opens a browser and whether it can be
// deleted, so they share the shape rather than the section carrying two lists.
interface Destination {
  providerId: string;
  title: string;
  location: string;
  enabled: boolean;
  config: S3ConfigMeta | null;
}

interface BackupSectionProps {
  boardId: number;
  boardName: string;
  onRestored: (summary: AppExportImportResult) => void;
}

function relativeTime(iso: string | null, t: ReturnType<typeof useT>): string {
  if (!iso) return t('backup.never');
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return t('backup.justNow');
  if (minutes < 60) return t('backup.minutesAgo', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('backup.hoursAgo', { count: hours });
  return t('backup.daysAgo', { count: Math.round(hours / 24) });
}

// One list of destinations, each with its own menu — replacing the three
// sections this used to be (S3, Local Backup, Cloud Sync), where a global
// auto-sync switch and two full-width buttons sat a screen away from the
// connections they acted on. Sync controls are scoped to one destination, so
// they belong in that destination's own menu.
export function BackupSection({ boardId, boardName, onRestored }: BackupSectionProps) {
  const t = useT();
  const [configs, setConfigs] = useState<S3ConfigMeta[]>([]);
  const [localOn, setLocalOn] = useState(false);
  const [autoById, setAutoById] = useState<Record<string, boolean>>({});
  const [lastSyncedById, setLastSyncedById] = useState<Record<string, string | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [browsing, setBrowsing] = useState<S3ConfigMeta | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const saved = await listS3Configs(db);
    const on = await isLocalBackupEnabled(db);
    const ids = [...saved.map((c) => `aws-s3:${c.id}`), LOCAL_PROVIDER_ID];
    const auto: Record<string, boolean> = {};
    const synced: Record<string, string | null> = {};
    for (const id of ids) {
      auto[id] = await isAutoSyncEnabled(db, id);
      synced[id] = await getLastSyncedAt(db, id);
    }
    setConfigs(saved);
    setLocalOn(on);
    setAutoById(auto);
    setLastSyncedById(synced);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const destinations: Destination[] = [
    ...configs.map((config) => ({
      providerId: `aws-s3:${config.id}`,
      title: config.bucket,
      location: config.keyPrefix ? `s3://${config.bucket}/${config.keyPrefix}` : `s3://${config.bucket}`,
      enabled: true,
      config,
    })),
    {
      providerId: LOCAL_PROVIDER_ID,
      title: t('backup.thisDevice'),
      location: t('backup.thisDeviceLocation'),
      enabled: localOn,
      config: null,
    },
  ];

  const setError = (providerId: string, message: string | null) =>
    setErrorById((current) => ({ ...current, [providerId]: message }));

  const toggleAuto = async (providerId: string) => {
    const db = await getDb();
    const next = !autoById[providerId];
    await setAutoSyncEnabled(db, providerId, next);
    setAutoById((current) => ({ ...current, [providerId]: next }));
  };

  const toggleLocal = async () => {
    const db = await getDb();
    await setLocalBackupEnabled(db, !localOn);
    setLocalOn(!localOn);
  };

  const runSync = async (providerId: string) => {
    setBusyId(providerId);
    setError(providerId, null);
    try {
      const db = await getDb();
      const [outcome] = await syncNow(db, boardId, boardName, { providerId });
      // No outcome at all means the destination isn't configured — for the
      // local row, that it's switched off. Silence there looks like a hang.
      if (!outcome) setError(providerId, t('backup.notEnabled'));
      else if (outcome.error) setError(providerId, outcome.error);
      else setLastSyncedById((current) => ({ ...current, [providerId]: outcome.syncedAt }));
    } finally {
      setBusyId(null);
    }
  };

  // Always a new board, never merged into the active one — confirmed first,
  // because it's a whole dataset appearing out of nowhere otherwise.
  const runRestore = (providerId: string, title: string) =>
    Alert.alert(t('backup.restoreConfirmTitle', { name: title }), t('backup.restoreConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.restore'),
        onPress: async () => {
          setBusyId(providerId);
          setError(providerId, null);
          try {
            const db = await getDb();
            const bytes = await downloadLatestBackup(db, boardId, boardName, providerId);
            if (!bytes) {
              setError(providerId, t('settings.noCloudBackupFound'));
              return;
            }
            onRestored(await importAppExport(db, await parseBackupZip(bytes)));
          } catch (e) {
            setError(providerId, e instanceof Error ? e.message : t('settings.restoreFailed'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);

  const confirmDelete = (config: S3ConfigMeta) =>
    Alert.alert(t('settings.deleteS3ConfigConfirmTitle', { name: config.bucket }), t('settings.deleteS3ConfigConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await removeS3Config(db, config.id);
          refresh();
        },
      },
    ]);

  // A bucket you just added is empty until the next change — which could be
  // days. The first backup goes up now, so "did that work" has an answer.
  const addBucket = async (input: S3ConfigInput) => {
    const db = await getDb();
    const id = await addS3Config(db, input);
    setAddOpen(false);
    await refresh();
    await runSync(`aws-s3:${id}`);
  };

  const menuFor = (destination: Destination): MenuItem[] => {
    const auto = autoById[destination.providerId] ?? true;
    const items: MenuItem[] = [
      {
        label: `${auto ? '✓ ' : ''}${t('backup.autoSync')}`,
        onPress: () => toggleAuto(destination.providerId),
      },
      { label: t('settings.syncNow'), onPress: () => runSync(destination.providerId) },
      { label: t('backup.restoreLatest'), onPress: () => runRestore(destination.providerId, destination.title) },
    ];
    if (destination.config) {
      // Destructive, red, last — same shape as every other row menu.
      items.push({ label: t('backup.deleteConnection'), destructive: true, onPress: () => confirmDelete(destination.config!) });
    } else {
      items.unshift({
        label: `${destination.enabled ? '✓ ' : ''}${t('backup.keepCopyHere')}`,
        onPress: toggleLocal,
      });
    }
    return items;
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{t('backup.heading')}</Text>
      <Text style={styles.sectionHint}>{t('backup.hint')}</Text>

      <View style={styles.group}>
        {destinations.map((destination, i) => (
          <View key={destination.providerId} style={[styles.row, i > 0 && styles.rowDivider]}>
            <Pressable
              style={styles.rowMain}
              disabled={destination.config == null}
              onPress={() => destination.config && setBrowsing(destination.config)}
            >
              <Text style={[styles.rowTitle, !destination.enabled && styles.rowTitleOff]}>{destination.title}</Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {destination.enabled
                  ? `${destination.location} · ${relativeTime(lastSyncedById[destination.providerId] ?? null, t)}`
                  : `${destination.location} · ${t('backup.off')}`}
              </Text>
              {errorById[destination.providerId] ? (
                <Text style={styles.rowError}>{errorById[destination.providerId]}</Text>
              ) : null}
            </Pressable>
            {busyId === destination.providerId ? <ActivityIndicator /> : null}
            <RowMenuButton items={menuFor(destination)} />
          </View>
        ))}
      </View>

      <Pressable style={styles.addLink} onPress={() => setAddOpen(true)}>
        <Text style={styles.addLinkText}>{t('settings.addS3BackupLink')}</Text>
      </Pressable>

      <S3ConfigModal visible={addOpen} onCancel={() => setAddOpen(false)} onSaved={addBucket} />
      <S3BrowserModal config={browsing} onClose={() => setBrowsing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, marginBottom: spacing.md },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  sectionHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12, paddingHorizontal: spacing.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, color: colors.text },
  rowTitleOff: { color: colors.textMuted },
  rowSubtitle: { fontSize: 12, color: colors.textMuted },
  rowError: { fontSize: 12, color: colors.negative },
  addLink: { alignItems: 'center', paddingVertical: spacing.sm },
  addLinkText: { color: colors.accent, fontWeight: '700' },
});
