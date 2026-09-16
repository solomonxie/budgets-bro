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
import { SecretField } from './SecretField';
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

// AWS's own lengths — used only for a hint under the field, never to block a
// save (see SecretField).
const ACCESS_KEY_LENGTH = 20;
const SECRET_KEY_LENGTH = 40;

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
  // The paste box is a *mode* of this field group, not a second box above it:
  // it replaces the fields while it's open. A permanent block at the top is
  // paid for on every visit (including the retries where nobody pastes),
  // pushes the real form below the fold, and leaves a stale secret sitting in
  // view above the fields it already filled.
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');

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
    setPasteMode(false);
    setPasteText('');
  };

  // Cleared in both directions — a pasted secret shouldn't stay in view, or
  // in state, once it has landed in the fields.
  const togglePasteMode = () => {
    setPasteText('');
    setPasteMode((open) => !open);
  };

  // Retyping a 40-character secret off a phone keyboard is where this form
  // actually fails, so the whole block can be pasted at once and split into
  // the fields. Parses on every change rather than behind an "apply" button —
  // the filled fields are the confirmation, and they say *which* four and stay
  // editable in place, which a "3 of 4" counter never did.
  const applyPaste = (text: string) => {
    // A real paste is a multi-character insert. Typing by hand keeps the box
    // open, or it would close under someone entering a second line.
    const pasted = text.length - pasteText.length > 1;
    setPasteText(text);

    const parsed = parseS3ConfigText(text);
    // Only overwrite what the block actually named: a half-filled paste must
    // not blank a field already typed by hand.
    if (parsed.bucket) setBucket(parsed.bucket);
    if (parsed.keyPrefix) setKeyPrefix(parsed.keyPrefix);
    if (parsed.accessKeyId) setAccessKeyId(parsed.accessKeyId);
    if (parsed.secretAccessKey) setSecretAccessKey(parsed.secretAccessKey);
    if (parsedFieldCount(parsed) === 0) return;

    setError(null);
    if (pasted) {
      setPasteText('');
      setPasteMode(false);
    }
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
          {/* The affordance lives in the group's own header, as a bracketed
              text button: one line, reads as part of the heading, and names
              what tapping it does in both directions. */}
          <Pressable onPress={togglePasteMode} style={styles.groupHeader}>
            <Text style={styles.groupHeading}>
              {t('s3ConfigModal.connectionHeading')}{' '}
              <Text style={styles.groupAction}>
                ({pasteMode ? t('s3ConfigModal.backToFields') : t('s3ConfigModal.pasteInfo')})
              </Text>
            </Text>
          </Pressable>

          {pasteMode ? (
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
              <Text style={styles.hint}>{t('s3ConfigModal.pasteHint')}</Text>
            </>
          ) : (
            <>
              <TextField
                label={t('settings.s3BucketLabel')}
                value={bucket}
                onChangeText={setBucket}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
              <TextField
                label={t('s3ConfigModal.keyPrefixLabel')}
                value={keyPrefix}
                onChangeText={setKeyPrefix}
                placeholder={t('s3ConfigModal.keyPrefixPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
              <SecretField
                label={t('settings.s3AccessKeyLabel')}
                value={accessKeyId}
                onChangeText={setAccessKeyId}
                expectedLength={ACCESS_KEY_LENGTH}
              />
              <SecretField
                label={t('settings.s3SecretKeyLabel')}
                value={secretAccessKey}
                onChangeText={setSecretAccessKey}
                expectedLength={SECRET_KEY_LENGTH}
              />
            </>
          )}

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
  groupHeader: { paddingVertical: 2 },
  groupHeading: { fontSize: 15, fontWeight: '700', color: colors.text },
  groupAction: { fontWeight: '600', color: colors.accent },
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
