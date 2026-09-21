import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TextField } from './TextField';
import { DropdownField, DropdownOption } from './DropdownField';
import { AI_VENDORS, runChatCompletionForVendor } from '../../ai/aiKeys';
import type { AiVendor } from '../../ai/aiKeys';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Unfolds under the "+ Add AI Connection" row rather than arriving as a
// sheet over the page: it is two fields, and a sheet covered the list of
// connections you were adding to. No separate "Test" button — Save sends
// one real, cheap request through the chosen provider and only saves once
// that succeeds, same flow as S3ConfigModal's test-then-save.
export function AiKeyForm({
  onSaved,
  onCancel,
}: {
  onSaved: (vendor: AiVendor, secret: string) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [vendor, setVendor] = useState<AiVendor>('openai');
  const [secret, setSecret] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vendorMeta = AI_VENDORS.find((v) => v.code === vendor)!;

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
      setSecret('');
      setVendor('openai');
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
      {testing ? <Text style={styles.hint}>{t('aiKeyModal.testing')}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable hitSlop={8} disabled={testing} onPress={onCancel}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={save} disabled={testing}>
          {testing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, paddingBottom: spacing.sm },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  linkText: { color: colors.accent, fontWeight: '600' },
  errorText: { fontSize: 13, color: colors.negative },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
