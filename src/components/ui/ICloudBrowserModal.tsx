import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { BackupFileList } from './BackupFileList';
import { BackupSaveLink } from './BackupSaveLink';
import ICloudDrive from '../../../modules/icloud-drive';
import { confirmBackupRestore } from './confirmBackupRestore';
import { importAppExport } from '../../import/appExportImporter';
import { getDb } from '../../db/client';
import { localeTag, useI18n } from '../../i18n';
import { colors } from '../../theme/colors';

// What the bucket browser is for S3, for the iCloud folder — the same
// question ("what is actually up there?") deserved the same answer, and
// tapping the row did nothing at all before.
//
// Flatter than the S3 one because the folder is: the native module lists
// keys, with no folders to walk into and no sizes or dates to show. iCloud
// keeps one rolling file per board rather than a file per month
// (src/sync/backupPath.ts), so this is usually a very short list — which is
// itself worth seeing, since "one file, overwritten" is the thing to know
// about this destination.
export function ICloudBrowserModal({
  visible,
  boardId,
  boardName,
  onClose,
  onRestored,
}: {
  visible: boolean;
  // The board a manual backup here copies — the one being used, not one of
  // the restored ones.
  boardId: number;
  boardName: string;
  onClose: () => void;
  // Fired after a restore, with the new board it landed in.
  onRestored?: (boardId: number) => void;
}) {
  const { t, language } = useI18n();
  const [keys, setKeys] = useState<string[]>([]);
  const [containerPath, setContainerPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ICloudDrive) return;
    setLoading(true);
    setError(null);
    try {
      setKeys(await ICloudDrive.list());
      setContainerPath(await ICloudDrive.getContainerPath());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const confirmRestore = (key: string) => {
    setError(null);
    confirmBackupRestore({
      t,
      locale: localeTag(language),
      name: key,
      load: async () => ICloudDrive?.read(key),
      setBusy: (busy) => setRestoringKey(busy ? key : null),
      onError: setError,
      onConfirmed: async (backup) => {
        setRestoringKey(key);
        try {
          const imported = await importAppExport(await getDb(), backup);
          onRestored?.(imported.boardId);
          onClose();
        } catch (e) {
          setError(e instanceof Error ? e.message : t('settings.restoreFailed'));
        } finally {
          setRestoringKey(null);
        }
      },
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScreenContainer modal>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.headerBtn}>{t('common.done')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('backup.icloud')}</Text>
          {loading ? <ActivityIndicator size="small" /> : <Text style={[styles.headerBtn, { opacity: 0 }]}>{t('common.done')}</Text>}
        </View>

        {/* Where to find the same files in the Files app, for anyone who
            would rather look at them there. */}
        <Text style={styles.hint}>{containerPath ?? t('backup.icloudLocation')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <ScrollView>
          {keys.length === 0 && !loading ? <Text style={styles.hint}>{t('s3Browser.empty')}</Text> : null}
          <BackupFileList
            restoreLabel={t('backup.restore')}
            entries={keys.map((key) => ({
              key,
              title: key,
              restoring: restoringKey === key,
              onRestore: restoringKey == null ? () => confirmRestore(key) : undefined,
            }))}
          />
          {/* A named copy sits beside the dated ones and is never pruned
              with them — pruning only recognises the automatic shape (see
              sync/backupPath.ts). */}
          <BackupSaveLink
            boardId={boardId}
            boardName={boardName}
            onSave={async (bytes, fileName) => {
              if (!ICloudDrive) throw new Error(t('backup.icloudNotReady'));
              await ICloudDrive.write(fileName, bytes);
            }}
            onSaved={refresh}
          />
        </ScrollView>
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  error: { fontSize: 12, color: colors.negative, lineHeight: 16 },
});
