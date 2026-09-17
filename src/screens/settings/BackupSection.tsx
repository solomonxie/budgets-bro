import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { S3ConfigModal } from '../../components/ui/S3ConfigModal';
import { S3BrowserModal } from '../../components/ui/S3BrowserModal';
import { getDb } from '../../db/client';
import { addS3Config, listS3Configs } from '../../sync/s3Provider';
import type { S3ConfigInput, S3ConfigMeta } from '../../sync/s3Provider';
import {
  ICLOUD_PROVIDER_ID,
  getICloudStatus,
  isICloudSupported,
} from '../../sync/icloudProvider';
import type { ICloudStatus } from '../../sync/icloudProvider';
import {
  getLastSyncedAt,
  isSyncEnabled,
  setSyncEnabled,
  syncNow,
} from '../../sync/cloudSync';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// One switch per destination, and that switch is the whole feature: on means
// every change is backed up there, off means nothing is. It replaced a row
// menu holding four items — a "keep a copy here" toggle, an "auto-sync"
// toggle, "Sync Now" and "Restore Latest" — whose combinations nobody could
// predict from the labels. Restore isn't here at all now: iCloud restores
// itself after a reinstall (sync/autoRestore.ts) and "Import a backup" in
// the Data section overrides everything by hand.
//
// Every destination here is off-device. An on-device copy used to sit at the
// bottom of this list, and it was the one thing a backup must not be: it
// lived in the same sandbox as the database, so deleting the app took both.
interface Destination {
  providerId: string;
  title: string;
  location: string;
  // Off means the switch is disabled and `note` says why. `action` is the
  // one sentence that fixes it, and only exists where the user can — a
  // reason they can't act on gets no instruction pretending otherwise.
  usable: boolean;
  note: string | null;
  action: string | null;
  // S3 only: what tapping the row browses, and what can be deleted.
  config: S3ConfigMeta | null;
}

// Every unusable state names itself in the row's subtitle. Kept beside the
// status union so a new state can't be added without deciding what it says.
const ICLOUD_NOTES: Record<ICloudStatus, TranslationKey | null> = {
  available: null,
  icloudOff: 'backup.icloudOff',
  notEntitled: 'backup.icloudNotEntitled',
  notReady: 'backup.icloudNotReady',
};

interface BackupSectionProps {
  boardId: number;
  boardName: string;
}

function relativeTime(iso: string | null, t: ReturnType<typeof useT>): string {
  if (!iso) return t('backup.never');
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (minutes < 1) return t('backup.justNow');
  if (minutes < 60) return t('backup.minutesAgo', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('backup.hoursAgo', { count: hours });
  return t('backup.daysAgo', { count: Math.round(hours / 24) });
}

export function BackupSection({ boardId, boardName }: BackupSectionProps) {
  const t = useT();
  const [configs, setConfigs] = useState<S3ConfigMeta[]>([]);
  const [icloudStatus, setICloudStatus] = useState<ICloudStatus>('available');
  const [onById, setOnById] = useState<Record<string, boolean>>({});
  const [lastSyncedById, setLastSyncedById] = useState<
    Record<string, string | null>
  >({});
  const [addOpen, setAddOpen] = useState(false);
  const [browsing, setBrowsing] = useState<S3ConfigMeta | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const saved = await listS3Configs(db);
    const ids = [ICLOUD_PROVIDER_ID, ...saved.map((c) => `aws-s3:${c.id}`)];
    const on: Record<string, boolean> = {};
    const synced: Record<string, string | null> = {};
    for (const id of ids) {
      on[id] = await isSyncEnabled(db, id);
      synced[id] = await getLastSyncedAt(db, id);
    }
    setConfigs(saved);
    setOnById(on);
    setLastSyncedById(synced);
    if (isICloudSupported()) setICloudStatus(await getICloudStatus());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The fix for a switched-off iCloud Drive happens in iOS Settings, so the
  // row has to notice on the way back rather than make them hunt for a
  // reload.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // iCloud first: it's the one destination with nothing to set up, so it
  // leads, and saved buckets follow in the order they were added.
  const destinations: Destination[] = [
    // Hidden entirely in Expo Go and on Android, where the native module the
    // iCloud entitlement ships with doesn't exist — a row that could never
    // work is worse than no row.
    ...(isICloudSupported()
      ? [
          {
            providerId: ICLOUD_PROVIDER_ID,
            title: t('backup.icloud'),
            location: t('backup.icloudLocation'),
            usable: icloudStatus === 'available',
            note: ICLOUD_NOTES[icloudStatus]
              ? t(ICLOUD_NOTES[icloudStatus]!)
              : null,
            // Only the switched-off case gets directions. An unsigned build
            // and a container still propagating are not things anyone can
            // fix in iOS Settings, and sending them there would waste a trip
            // — which is exactly what an earlier "Sign in to iCloud" did.
            action:
              icloudStatus === 'icloudOff' ? t('backup.icloudOffAction') : null,
            config: null,
          },
        ]
      : []),
    ...configs.map((config) => ({
      providerId: `aws-s3:${config.id}`,
      title: config.bucket,
      location: config.keyPrefix
        ? `s3://${config.bucket}/${config.keyPrefix}`
        : `s3://${config.bucket}`,
      usable: true,
      note: null,
      action: null,
      config,
    })),
  ];

  // Flipping a switch on backs up straight away rather than waiting for the
  // next edit, which could be days — "did that work" needs an answer now.
  const toggle = async (providerId: string, next: boolean) => {
    const db = await getDb();
    await setSyncEnabled(db, providerId, next);
    setOnById((current) => ({ ...current, [providerId]: next }));
    if (!next) return;
    const outcomes = await syncNow(db, boardId, boardName);
    const mine = outcomes.find((o) => o.providerId === providerId);
    if (mine?.syncedAt) {
      setLastSyncedById((current) => ({
        ...current,
        [providerId]: mine.syncedAt,
      }));
    }
  };

  const addBucket = async (input: S3ConfigInput) => {
    const db = await getDb();
    const id = await addS3Config(db, input);
    setAddOpen(false);
    await refresh();
    await toggle(`aws-s3:${id}`, true);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{t('backup.heading')}</Text>
      <Text style={styles.sectionHint}>{t('backup.hint')}</Text>

      <View style={styles.group}>
        {destinations.map((destination, i) => (
          <View
            key={destination.providerId}
            style={[styles.row, i > 0 && styles.rowDivider]}
          >
            <Pressable
              style={styles.rowMain}
              disabled={destination.config == null}
              onPress={() =>
                destination.config && setBrowsing(destination.config)
              }
            >
              <Text
                style={[
                  styles.rowTitle,
                  !destination.usable && styles.rowTitleOff,
                ]}
              >
                {destination.title}
              </Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {destination.note ??
                  (onById[destination.providerId]
                    ? `${destination.location} · ${relativeTime(lastSyncedById[destination.providerId] ?? null, t)}`
                    : destination.location)}
              </Text>
              {destination.action ? (
                <Text style={styles.rowAction}>{destination.action}</Text>
              ) : null}
            </Pressable>
            <Switch
              value={
                (onById[destination.providerId] ?? false) && destination.usable
              }
              disabled={!destination.usable}
              onValueChange={(next) => toggle(destination.providerId, next)}
            />
          </View>
        ))}
      </View>

      <Pressable style={styles.addLink} onPress={() => setAddOpen(true)}>
        <Text style={styles.addLinkText}>{t('settings.addS3BackupLink')}</Text>
      </Pressable>

      <S3ConfigModal
        visible={addOpen}
        onCancel={() => setAddOpen(false)}
        onSaved={addBucket}
      />
      <S3BrowserModal
        config={browsing}
        onClose={() => setBrowsing(null)}
        onDeleted={() => {
          setBrowsing(null);
          refresh();
        }}
      />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, color: colors.text },
  rowTitleOff: { color: colors.textMuted },
  rowSubtitle: { fontSize: 12, color: colors.textMuted },
  rowAction: { fontSize: 12, color: colors.accent, lineHeight: 17 },
  addLink: { alignItems: 'center', paddingVertical: spacing.sm },
  addLinkText: { color: colors.accent, fontWeight: '700' },
});
