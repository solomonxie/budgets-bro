import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { PromptModal } from './PromptModal';
import { getDb } from '../../db/client';
import { buildBackupZip } from '../../sync/buildBackup';
import { backupKey, sanitizeBackupFileName } from '../../sync/backupPath';
import { currentDateISO } from '../../domain/month';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface BackupSaveLinkProps {
  boardId: number;
  boardName: string;
  // Where the zip goes, under the name the user typed — a key in the folder
  // being browsed, a file name in the iCloud folder.
  onSave: (bytes: Uint8Array, fileName: string) => Promise<void>;
  onSaved: () => void;
}

// "Back up this board here, under a name I choose" — the manual counterpart
// to the automatic daily backup, offered at the bottom of whichever
// destination is open.
//
// Automatic backups name themselves after the board and the date, which is
// right for a history nobody reads until they need it and wrong for the copy
// you take deliberately before importing something risky: that one wants to
// be called "before the YNAB import", so you can find it a month later.
// A typed name never overwrites the dated series either (see backupPath.ts:
// pruning only touches keys that match the automatic shape).
export function BackupSaveLink({ boardId, boardName, onSave, onSaved }: BackupSaveLinkProps) {
  const t = useT();
  const [prompting, setPrompting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultName = backupKey(boardName, currentDateISO(), 'manual');

  const save = async (typed: string) => {
    setPrompting(false);
    setSaving(true);
    setError(null);
    try {
      const db = await getDb();
      const bytes = await buildBackupZip(db, boardId, boardName);
      await onSave(bytes, sanitizeBackupFileName(typed, defaultName));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('backup.saveCopyFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.link} disabled={saving} onPress={() => setPrompting(true)}>
        {saving ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={styles.linkText}>{t('backup.saveCopyHere')}</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PromptModal
        visible={prompting}
        title={t('backup.saveCopyTitle')}
        placeholder={defaultName}
        initialValue={defaultName}
        onCancel={() => setPrompting(false)}
        onSubmit={save}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  link: { alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { color: colors.accent, fontWeight: '700' },
  error: { fontSize: 12, color: colors.negative, textAlign: 'center' },
});
