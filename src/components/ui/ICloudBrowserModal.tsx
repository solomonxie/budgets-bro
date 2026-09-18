import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { BackupFileList } from './BackupFileList';
import ICloudDrive from '../../../modules/icloud-drive';
import { parseBackupZip } from '../../sync/parseBackupZip';
import { importAppExport } from '../../import/appExportImporter';
import { getDb } from '../../db/client';
import { useT } from '../../i18n';
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
  onClose,
  onRestored,
}: {
  visible: boolean;
  onClose: () => void;
  onRestored?: () => void;
}) {
  const t = useT();
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
    Alert.alert(t('s3Browser.restoreConfirmTitle', { name: key }), t('s3Browser.restoreConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.restore'),
        onPress: async () => {
          setRestoringKey(key);
          setError(null);
          try {
            const bytes = await ICloudDrive?.read(key);
            if (!bytes) throw new Error(t('s3Browser.restoreNotFound'));
            await importAppExport(await getDb(), await parseBackupZip(bytes));
            onRestored?.();
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
