import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { TextField } from './TextField';
import { getDb } from '../../db/client';
import {
  testS3Connection,
  listS3Drafts,
  saveS3Draft,
  getS3Draft,
  removeS3Draft,
  DEFAULT_S3_KEY_PREFIX,
} from '../../sync/s3Provider';
import type { S3ConfigInput, S3DraftMeta } from '../../sync/s3Provider';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface S3ConfigModalProps {
  visible: boolean;
  onCancel: () => void;
  onSaved: (input: S3ConfigInput) => Promise<void>;
}

// Full-screen form for adding one S3 bucket to back up to — Save runs
// testS3Connection first (auto-detects the region, then a real
// upload+delete round-trip) and only calls onSaved, which persists the
// config, once that succeeds.
export function S3ConfigModal({ visible, onCancel, onSaved }: S3ConfigModalProps) {
  const t = useT();
  const [bucket, setBucket] = useState('');
  const [keyPrefix, setKeyPrefix] = useState(DEFAULT_S3_KEY_PREFIX);
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<S3DraftMeta[]>([]);

  const refreshDrafts = async () => {
    const db = await getDb();
    setDrafts(await listS3Drafts(db));
  };

  useEffect(() => {
    if (visible) refreshDrafts();
  }, [visible]);

  const reset = () => {
    setBucket('');
    setKeyPrefix(DEFAULT_S3_KEY_PREFIX);
    setAccessKeyId('');
    setSecretAccessKey('');
    setError(null);
  };

  const cancel = () => {
    reset();
    onCancel();
  };

  const fillFromDraft = async (id: string) => {
    const db = await getDb();
    const draft = await getS3Draft(db, id);
    if (!draft) return;
    setBucket(draft.bucket);
    setKeyPrefix(draft.keyPrefix ?? DEFAULT_S3_KEY_PREFIX);
    setAccessKeyId(draft.accessKeyId);
    setSecretAccessKey(draft.secretAccessKey);
    setError(null);
  };

  const deleteDraft = async (id: string) => {
    const db = await getDb();
    await removeS3Draft(db, id);
    refreshDrafts();
  };

  const save = async () => {
    if (!bucket.trim() || !accessKeyId.trim() || !secretAccessKey.trim()) {
      setError(t('s3ConfigModal.missingFields'));
      return;
    }
    const connection = { bucket: bucket.trim(), keyPrefix: keyPrefix.trim(), accessKeyId: accessKeyId.trim(), secretAccessKey: secretAccessKey.trim() };
    setTesting(true);
    setError(null);
    const db = await getDb();
    // Saved before testing — so a failed attempt is never lost, and a retry
    // (or a second bucket reusing the same keys) never has to retype anything.
    const draftId = await saveS3Draft(db, connection);
    try {
      const region = await testS3Connection(connection);
      const input: S3ConfigInput = { ...connection, region };
      await onSaved(input);
      await removeS3Draft(db, draftId);
      reset();
    } catch (e) {
      setError(t('s3ConfigModal.testFailed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setTesting(false);
      refreshDrafts();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
      <ScreenContainer modal>
        <View style={styles.header}>
          <Pressable onPress={cancel}>
            <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('s3ConfigModal.title')}</Text>
          <Pressable onPress={save} disabled={testing}>
            {testing ? <ActivityIndicator /> : <Text style={[styles.headerBtn, styles.saveBtn]}>{t('common.save')}</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <TextField label={t('settings.s3BucketLabel')} value={bucket} onChangeText={setBucket} autoCapitalize="none" autoCorrect={false} />
          <TextField
            label={t('s3ConfigModal.keyPrefixLabel')}
            value={keyPrefix}
            onChangeText={setKeyPrefix}
            placeholder={t('s3ConfigModal.keyPrefixPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField label={t('settings.s3AccessKeyLabel')} value={accessKeyId} onChangeText={setAccessKeyId} autoCapitalize="none" autoCorrect={false} />
          <TextField label={t('settings.s3SecretKeyLabel')} value={secretAccessKey} onChangeText={setSecretAccessKey} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          {testing ? <Text style={styles.hint}>{t('s3ConfigModal.testing')}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {drafts.length > 0 ? (
            <View style={styles.draftsSection}>
              <Text style={styles.draftsHeading}>{t('s3ConfigModal.draftsHeading')}</Text>
              <Text style={styles.hint}>{t('s3ConfigModal.draftsHint')}</Text>
              {drafts.map((draft) => (
                <Pressable key={draft.id} style={styles.draftRow} onPress={() => fillFromDraft(draft.id)}>
                  <View style={styles.draftRowMain}>
                    <Text style={styles.draftBucket}>{draft.bucket}</Text>
                    {draft.keyPrefix ? <Text style={styles.draftSub}>{draft.keyPrefix}</Text> : null}
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={(e) => {
                      e.stopPropagation();
                      deleteDraft(draft.id);
                    }}
                  >
                    <Text style={styles.draftDelete}>✕</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  saveBtn: { color: colors.accent },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  form: { gap: spacing.md, paddingTop: spacing.md },
  hint: { fontSize: 13, color: colors.textMuted },
  errorText: { fontSize: 13, color: colors.negative },
  draftsSection: { marginTop: spacing.md, gap: spacing.xs },
  draftsHeading: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  draftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  draftRowMain: { flex: 1, gap: 2 },
  draftBucket: { fontSize: 14, fontWeight: '600', color: colors.text },
  draftSub: { fontSize: 12, color: colors.textMuted },
  draftDelete: { fontSize: 15, color: colors.textMuted, paddingLeft: spacing.md },
});
