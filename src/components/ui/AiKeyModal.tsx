import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { TextField } from './TextField';
import { runChatCompletionForVendor } from '../../ai/aiKeys';
import type { AiVendor } from '../../ai/aiKeys';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const VENDORS: { code: AiVendor; name: string }[] = [
  { code: 'openai', name: 'OpenAI' },
  { code: 'anthropic', name: 'Anthropic' },
];

interface AiKeyModalProps {
  visible: boolean;
  onCancel: () => void;
  onSaved: (vendor: AiVendor, secret: string) => Promise<void>;
}

// No separate "Test Connection" button — Save itself sends one real,
// cheap request through the chosen vendor's client and only calls
// onSaved (which persists the key) once that succeeds, same flow as
// S3ConfigModal's own test-then-save.
export function AiKeyModal({ visible, onCancel, onSaved }: AiKeyModalProps) {
  const t = useT();
  const [vendor, setVendor] = useState<AiVendor>('openai');
  const [secret, setSecret] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setVendor('openai');
    setSecret('');
    setError(null);
  };

  const cancel = () => {
    reset();
    onCancel();
  };

  const save = async () => {
    if (!secret.trim()) {
      setError(t('aiKeyModal.missingKey'));
      return;
    }
    setTesting(true);
    setError(null);
    try {
      await runChatCompletionForVendor(vendor, secret.trim(), [
        { role: 'user', content: 'Reply with "ok".' },
      ]);
      await onSaved(vendor, secret.trim());
      reset();
    } catch (e) {
      setError(
        t('aiKeyModal.testFailed', {
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={cancel}
    >
      <ScreenContainer modal>
        <View style={styles.header}>
          <Pressable onPress={cancel}>
            <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('aiKeyModal.title')}</Text>
          <Pressable onPress={save} disabled={testing}>
            {testing ? (
              <ActivityIndicator />
            ) : (
              <Text style={[styles.headerBtn, styles.saveBtn]}>
                {t('common.save')}
              </Text>
            )}
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.segmented}>
            {VENDORS.map((v) => (
              <Pressable
                key={v.code}
                style={[
                  styles.segment,
                  vendor === v.code && styles.segmentActive,
                ]}
                onPress={() => setVendor(v.code)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    vendor === v.code && styles.segmentTextActive,
                  ]}
                >
                  {v.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextField
            label={t('aiKeyModal.keyLabel')}
            placeholder={vendor === 'openai' ? 'sk-...' : 'sk-ant-...'}
            value={secret}
            onChangeText={setSecret}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          {testing ? (
            <Text style={styles.hint}>{t('aiKeyModal.testing')}</Text>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
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
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  saveBtn: { color: colors.accent },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  form: { gap: spacing.md, paddingTop: spacing.md },
  hint: { fontSize: 13, color: colors.textMuted },
  errorText: { fontSize: 13, color: colors.negative },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
});
