import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { TextField } from './TextField';
import { testS3Connection } from '../../sync/s3Provider';
import type { S3ConfigInput } from '../../sync/s3Provider';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface S3ConfigModalProps {
  visible: boolean;
  onCancel: () => void;
  onSaved: (input: S3ConfigInput) => Promise<void>;
}

// Full-screen form for adding one S3 bucket to back up to — Save runs
// testS3Connection first (a real upload+delete round-trip) and only calls
// onSaved, which persists the config, once that succeeds.
export function S3ConfigModal({ visible, onCancel, onSaved }: S3ConfigModalProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [bucket, setBucket] = useState('');
  const [region, setRegion] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setBucket('');
    setRegion('');
    setAccessKeyId('');
    setSecretAccessKey('');
    setError(null);
  };

  const cancel = () => {
    reset();
    onCancel();
  };

  const save = async () => {
    if (!bucket.trim() || !region.trim() || !accessKeyId.trim() || !secretAccessKey.trim()) {
      setError(t('s3ConfigModal.missingFields'));
      return;
    }
    const input: S3ConfigInput = { name: name.trim(), bucket: bucket.trim(), region: region.trim(), accessKeyId: accessKeyId.trim(), secretAccessKey: secretAccessKey.trim() };
    setTesting(true);
    setError(null);
    try {
      await testS3Connection(input);
      await onSaved(input);
      reset();
    } catch (e) {
      setError(t('s3ConfigModal.testFailed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setTesting(false);
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
          <TextField label={t('s3ConfigModal.nameLabel')} value={name} onChangeText={setName} placeholder={t('s3ConfigModal.namePlaceholder')} />
          <TextField label={t('settings.s3BucketLabel')} value={bucket} onChangeText={setBucket} autoCapitalize="none" autoCorrect={false} />
          <TextField label={t('settings.s3RegionLabel')} value={region} onChangeText={setRegion} placeholder="e.g. us-east-1" autoCapitalize="none" autoCorrect={false} />
          <TextField label={t('settings.s3AccessKeyLabel')} value={accessKeyId} onChangeText={setAccessKeyId} autoCapitalize="none" autoCorrect={false} />
          <TextField label={t('settings.s3SecretKeyLabel')} value={secretAccessKey} onChangeText={setSecretAccessKey} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          {testing ? <Text style={styles.hint}>{t('s3ConfigModal.testing')}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
});
