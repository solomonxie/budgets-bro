import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { RowMenuButton } from './RowMenuButton';
import { BackupFileList } from './BackupFileList';
import { BackupSaveLink } from './BackupSaveLink';
import { getDb } from '../../db/client';
import {
  downloadS3Object,
  listS3Objects,
  removeS3Config,
  uploadS3Object,
} from '../../sync/s3Provider';
import { parseBackupZip } from '../../sync/parseBackupZip';
import { importAppExport } from '../../import/appExportImporter';
import type { S3ConfigMeta, S3ListEntry } from '../../sync/s3Provider';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface S3BrowserModalProps {
  config: S3ConfigMeta | null;
  // The board a manual backup here copies — the one being used, not one of
  // the restored ones.
  boardId: number;
  boardName: string;
  onClose: () => void;
  onDeleted: () => void;
  // Fired after a restore, with the new board it landed in — the screen
  // behind switches to it and reloads.
  onRestored?: (boardId: number) => void;
}

function basename(fullPrefixOrKey: string): string {
  return fullPrefixOrKey.replace(/\/$/, '').split('/').pop() ?? fullPrefixOrKey;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}

// Browser for one saved bucket's content — scoped to its configured
// keyPrefix, which is the root here (`path` never goes above it, see
// s3Provider.listS3Objects).
//
// A .zip here can be restored in place. It used to be listing only, on the
// reasoning that restoring by hand goes through "Import a backup" — but that
// means fetching the object from somewhere that isn't the phone first, which
// is no use when the phone is what you have. Same bytes either way:
// download, parseBackupZip, importAppExport.
//
// It also owns "Delete Connection": the Settings row is a bare switch now,
// so a destination's rare and destructive action lives one level down,
// behind a deliberate tap, instead of in a menu next to the switch.
export function S3BrowserModal({
  config,
  boardId,
  boardName,
  onClose,
  onDeleted,
  onRestored,
}: S3BrowserModalProps) {
  const t = useT();
  const [path, setPath] = useState<string[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [objects, setObjects] = useState<S3ListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  // Bumped after writing a backup here, so the listing shows the file that
  // was just uploaded without making the user leave and come back.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!config) return;
    setPath([]);
  }, [config]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const db = await getDb();
        const result = await listS3Objects(db, config.id, path.join('/'));
        if (cancelled) return;
        setPrefixes(result.prefixes);
        setObjects(result.objects);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config, path, reloadToken]);

  if (!config) return null;

  const confirmDelete = () =>
    Alert.alert(
      t('settings.deleteS3ConfigConfirmTitle', { name: config.bucket }),
      t('settings.deleteS3ConfigConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await removeS3Config(await getDb(), config.id);
            onDeleted();
          },
        },
      ],
    );

  // A restore never touches the board in use: the zip comes back as a board
  // of its own (see appExportImporter) and the app switches to it, so a file
  // opened out of curiosity costs nothing but a switch back. It still asks
  // first, and names the file it is about to open.
  const confirmRestore = (key: string) => {
    if (!config) return;
    Alert.alert(t('s3Browser.restoreConfirmTitle', { name: basename(key) }), t('s3Browser.restoreConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.restore'),
        onPress: async () => {
          setRestoringKey(key);
          setError(null);
          try {
            const db = await getDb();
            const bytes = await downloadS3Object(db, config.id, key);
            if (!bytes) throw new Error(t('s3Browser.restoreNotFound'));
            const imported = await importAppExport(db, await parseBackupZip(bytes));
            onRestored?.(imported.boardId);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : t('settings.restoreFailed'));
          } finally {
            setRestoringKey(null);
          }
        },
      },
    ]);
  };

  const crumbs = [
    config.bucket,
    ...(config.keyPrefix ? [config.keyPrefix] : []),
    ...path,
  ];
  const rootCrumbCount = crumbs.length - path.length;

  return (
    <Modal
      visible={config != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ScreenContainer modal>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.headerBtn}>{t('common.done')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('s3Browser.title')}</Text>
          {/* Removing the bucket is a once-ever action and a destructive
              one, so it sits behind the menu rather than under the listing,
              where it was a permanent red invitation at the bottom of a page
              you open to read files. */}
          <RowMenuButton
            items={[{ label: t('backup.deleteConnection'), destructive: true, onPress: confirmDelete }]}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.breadcrumbs}
          contentContainerStyle={styles.breadcrumbsContent}
        >
          {crumbs.map((crumb, i) => (
            <Pressable
              key={i}
              onPress={() =>
                setPath(
                  i < rootCrumbCount
                    ? []
                    : path.slice(0, i - rootCrumbCount + 1),
                )
              }
              disabled={i === crumbs.length - 1}
            >
              <Text
                style={[
                  styles.crumb,
                  i === crumbs.length - 1 && styles.crumbActive,
                ]}
              >
                {crumb}
                {i < crumbs.length - 1 ? ' / ' : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? <ActivityIndicator style={styles.spinner} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && !error ? (
          <ScrollView contentContainerStyle={styles.list}>
            <BackupFileList
              restoreLabel={t('backup.restore')}
              entries={[
                ...(path.length > 0
                  ? [{ key: '..', title: t('s3Browser.up'), onOpen: () => setPath(path.slice(0, -1)) }]
                  : []),
                ...prefixes.map((prefix) => ({
                  key: prefix,
                  title: basename(prefix),
                  onOpen: () => setPath([...path, basename(prefix)]),
                })),
                ...objects.map((obj) => ({
                  key: obj.key,
                  title: basename(obj.key),
                  subtitle: `${formatSize(obj.size)} · ${new Date(obj.lastModified).toLocaleDateString()}`,
                  restoring: restoringKey === obj.key,
                  onRestore: obj.key.toLowerCase().endsWith('.zip') ? () => confirmRestore(obj.key) : undefined,
                })),
              ]}
            />
            {prefixes.length === 0 && objects.length === 0 ? (
              <Text style={styles.hint}>{t('s3Browser.empty')}</Text>
            ) : null}
          </ScrollView>
        ) : null}

        {/* Outside the listing, because plenty of buckets are set up
            write-only: not being able to read what is there is no reason not
            to be able to put something there. Lands in the folder being
            browsed, which is the only place "here" could mean. */}
        {loading ? null : (
          <BackupSaveLink
            boardId={boardId}
            boardName={boardName}
            onSave={async (bytes, fileName) => {
              const db = await getDb();
              await uploadS3Object(db, config.id, [...path, fileName].join('/'), bytes);
            }}
            onSaved={() => setReloadToken((n) => n + 1)}
          />
        )}
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    minWidth: 40,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  breadcrumbs: { flexGrow: 0, marginTop: spacing.sm },
  breadcrumbsContent: { paddingVertical: spacing.xs },
  crumb: { fontSize: 13, color: colors.textMuted },
  crumbActive: { color: colors.text, fontWeight: '700' },
  spinner: { marginTop: spacing.lg },
  errorText: { color: colors.negative, fontSize: 13, marginTop: spacing.md },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  list: { paddingTop: spacing.sm, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  restoreLink: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  restoreLinkDisabled: { opacity: 0.4 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, color: colors.text },
  rowValue: { fontSize: 12, color: colors.textMuted },
});
