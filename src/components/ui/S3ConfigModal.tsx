import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheet } from './BottomSheet';
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
import { parseS3ConfigText, parsedFieldCount } from '../../sync/parseS3ConfigText';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface S3ConfigModalProps {
  visible: boolean;
  onCancel: () => void;
  onSaved: (input: S3ConfigInput) => Promise<void>;
}

// Half-height sheet, not a full page — four fields and an optional drafts
// list still fit and scroll within it. Save runs testS3Connection first
// (auto-detects the region, then a real upload+delete round-trip) and only
// calls onSaved, which persists the config, once that succeeds.
export function S3ConfigModal({
  visible,
  onCancel,
  onSaved,
}: S3ConfigModalProps) {
  const t = useT();
  const [bucket, setBucket] = useState('');
  const [keyPrefix, setKeyPrefix] = useState(DEFAULT_S3_KEY_PREFIX);
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<S3DraftMeta[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  // null until something has been pasted — so the hint only appears once
  // there's a result to report.
  const [pasteFilled, setPasteFilled] = useState<number | null>(null);

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
    setPasteOpen(false);
    setPasteText('');
    setPasteFilled(null);
  };

  // Retyping a 40-character secret off a phone keyboard is where this form
  // actually fails, so the whole block can be pasted at once and split into
  // the fields below. Fills on every change rather than behind an "apply"
  // button — the filled fields are the confirmation.
  const applyPaste = (text: string) => {
    setPasteText(text);
    const parsed = parseS3ConfigText(text);
    const count = parsedFieldCount(parsed);
    setPasteFilled(text.trim() ? count : null);
    if (count === 0) return;
    if (parsed.bucket) setBucket(parsed.bucket);
    if (parsed.keyPrefix) setKeyPrefix(parsed.keyPrefix);
    if (parsed.accessKeyId) setAccessKeyId(parsed.accessKeyId);
    if (parsed.secretAccessKey) setSecretAccessKey(parsed.secretAccessKey);
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
    const connection = {
      bucket: bucket.trim(),
      keyPrefix: keyPrefix.trim(),
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
    };
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
      setError(
        t('s3ConfigModal.testFailed', {
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setTesting(false);
      refreshDrafts();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={cancel}
    >
      <BottomSheet title={t('s3ConfigModal.title')} onClose={cancel}>
        <View style={styles.form}>
          <Pressable onPress={() => setPasteOpen((open) => !open)}>
            <Text style={styles.pasteToggle}>{t('s3ConfigModal.pasteToggle')}</Text>
          </Pressable>
          {pasteOpen ? (
            <>
              <TextField
                value={pasteText}
                onChangeText={applyPaste}
                placeholder={t('s3ConfigModal.pastePlaceholder')}
                style={styles.pasteInput}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
              />
              {pasteFilled != null ? (
                <Text style={pasteFilled > 0 ? styles.hint : styles.errorText}>
                  {pasteFilled > 0
                    ? t('s3ConfigModal.pasteFilled', { count: pasteFilled })
                    : t('s3ConfigModal.pasteNothing')}
                </Text>
              ) : null}
            </>
          ) : null}
          <TextField
            label={t('settings.s3BucketLabel')}
            value={bucket}
            onChangeText={setBucket}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            label={t('s3ConfigModal.keyPrefixLabel')}
            value={keyPrefix}
            onChangeText={setKeyPrefix}
            placeholder={t('s3ConfigModal.keyPrefixPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            label={t('settings.s3AccessKeyLabel')}
            value={accessKeyId}
            onChangeText={setAccessKeyId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            label={t('settings.s3SecretKeyLabel')}
            value={secretAccessKey}
            onChangeText={setSecretAccessKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          {testing ? (
            <Text style={styles.hint}>{t('s3ConfigModal.testing')}</Text>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable
            style={styles.saveButton}
            onPress={save}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            )}
          </Pressable>

          {drafts.length > 0 ? (
            <View style={styles.draftsSection}>
              <Text style={styles.draftsHeading}>
                {t('s3ConfigModal.draftsHeading')}
              </Text>
              <Text style={styles.hint}>{t('s3ConfigModal.draftsHint')}</Text>
              {drafts.map((draft) => (
                <Pressable
                  key={draft.id}
                  style={styles.draftRow}
                  onPress={() => fillFromDraft(draft.id)}
                >
                  <View style={styles.draftRowMain}>
                    <Text style={styles.draftBucket}>{draft.bucket}</Text>
                    {draft.keyPrefix ? (
                      <Text style={styles.draftSub}>{draft.keyPrefix}</Text>
                    ) : null}
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
        </View>
      </BottomSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pasteToggle: { fontSize: 13, fontWeight: '600', color: colors.accent },
  // Tall enough that a four-line block is visible without scrolling the
  // field itself, which is what makes a mis-paste obvious.
  pasteInput: { minHeight: 92, textAlignVertical: 'top' },
  form: { gap: spacing.md, paddingBottom: spacing.md },
  hint: { fontSize: 13, color: colors.textMuted },
  errorText: { fontSize: 13, color: colors.negative },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  draftsSection: { marginTop: spacing.xs, gap: spacing.xs },
  draftsHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
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
  draftDelete: {
    fontSize: 15,
    color: colors.textMuted,
    paddingLeft: spacing.md,
  },
});
