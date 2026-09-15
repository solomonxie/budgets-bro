import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheet } from './BottomSheet';
import { TextField } from './TextField';
import { DropdownField, DropdownOption } from './DropdownField';
import { AI_VENDORS, runChatCompletionForVendor } from '../../ai/aiKeys';
import type { AiVendor } from '../../ai/aiKeys';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface AiKeyModalProps {
  visible: boolean;
  onCancel: () => void;
  onSaved: (vendor: AiVendor, secret: string) => Promise<void>;
}

// Half-height sheet, not a full page — a vendor picker and one text field
// don't need more room. No separate "Test Connection" button: Save itself
// sends one real, cheap request through the chosen vendor's client and
// only calls onSaved (which persists the key) once that succeeds, same
// flow as S3ConfigModal's own test-then-save.
export function AiKeyModal({ visible, onCancel, onSaved }: AiKeyModalProps) {
  const t = useT();
  const [vendor, setVendor] = useState<AiVendor>('openai');
  const [secret, setSecret] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vendorMeta = AI_VENDORS.find((v) => v.code === vendor)!;

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
      transparent
      animationType="slide"
      onRequestClose={cancel}
    >
      <BottomSheet title={t('aiKeyModal.title')} onClose={cancel}>
        <View style={styles.form}>
          <DropdownField
            compact
            label={t('aiKeyModal.vendorLabel')}
            valueLabel={vendorMeta.name}
          >
            {(close) => (
              <>
                {AI_VENDORS.map((v) => (
                  <DropdownOption
                    key={v.code}
                    label={v.name}
                    selected={vendor === v.code}
                    onPress={() => {
                      setVendor(v.code);
                      close();
                    }}
                  />
                ))}
              </>
            )}
          </DropdownField>
          <TextField
            label={t('aiKeyModal.keyLabel')}
            placeholder={vendorMeta.keyHint}
            value={secret}
            onChangeText={setSecret}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.hint}>
            {t('aiKeyModal.getKeyHint', { vendor: vendorMeta.name })}{' '}
            <Text
              style={styles.linkText}
              onPress={() => Linking.openURL(vendorMeta.docsUrl)}
            >
              {t('aiKeyModal.getKeyLink')}
            </Text>
          </Text>
          {testing ? (
            <Text style={styles.hint}>{t('aiKeyModal.testing')}</Text>
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
        </View>
      </BottomSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.md },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  linkText: { color: colors.accent, fontWeight: '600' },
  errorText: { fontSize: 13, color: colors.negative },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
