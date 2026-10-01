import { useEffect, useState } from 'react';
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
import { AI_TEST_TIMEOUT_MS, AI_VENDORS, runChatCompletionForVendor, vendorAllowed } from '../../ai/aiKeys';
import type { AiVendor, CustomEndpoint } from '../../ai/aiKeys';
import { isChinaStorefront } from '../../ai/storefront';
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
  onSaved: (vendor: AiVendor, secret: string, custom?: CustomEndpoint) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [vendors, setVendors] = useState(AI_VENDORS);
  const [vendor, setVendor] = useState<AiVendor>('openai');
  const [secret, setSecret] = useState('');
  const [custom, setCustom] = useState<CustomEndpoint>({ label: '', endpoint: '', model: '' });
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isChinaStorefront().then((inChina) => {
      const allowed = AI_VENDORS.filter((v) => vendorAllowed(v.code, inChina));
      setVendors(allowed);
      setVendor(allowed[0].code);
    });
  }, []);

  const vendorMeta = vendors.find((v) => v.code === vendor) ?? vendors[0];
  const isCustom = vendor === 'custom';
  const customEndpoint: CustomEndpoint = {
    label: custom.label.trim(),
    endpoint: custom.endpoint.trim(),
    model: custom.model.trim(),
  };

  const save = async () => {
    if (!secret.trim()) {
      setError(t('aiKeyModal.missingKey'));
      return;
    }
    if (isCustom && (!customEndpoint.endpoint || !customEndpoint.model)) {
      setError(t('aiKeyModal.missingEndpoint'));
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const endpoint = isCustom ? customEndpoint : undefined;
      await runChatCompletionForVendor(
        vendor,
        secret.trim(),
        [{ role: 'user', content: 'Reply with "ok".' }],
        endpoint,
        AI_TEST_TIMEOUT_MS,
      );
      await onSaved(vendor, secret.trim(), endpoint);
      setSecret('');
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
            {vendors.map((v) => (
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
      {isCustom ? (
        <>
          <TextField
            label={t('aiKeyModal.customName')}
            placeholder="My server"
            value={custom.label}
            onChangeText={(label) => setCustom({ ...custom, label })}
          />
          <TextField
            label={t('aiKeyModal.customEndpoint')}
            placeholder="https://example.com/v1"
            value={custom.endpoint}
            onChangeText={(endpoint) => setCustom({ ...custom, endpoint })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TextField
            label={t('aiKeyModal.customModel')}
            placeholder="model-name"
            value={custom.model}
            onChangeText={(model) => setCustom({ ...custom, model })}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      ) : null}
      <TextField
        label={t('aiKeyModal.keyLabel')}
        placeholder={vendorMeta.keyHint}
        value={secret}
        onChangeText={setSecret}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      {vendorMeta.docsUrl ? (
      <Text style={styles.hint}>
        {t('aiKeyModal.getKeyHint', { vendor: vendorMeta.name })}{' '}
        <Text
          style={styles.linkText}
          onPress={() => Linking.openURL(vendorMeta.docsUrl)}
        >
          {t('aiKeyModal.getKeyLink')}
        </Text>
      </Text>
      ) : (
        <Text style={styles.hint}>{t('aiKeyModal.customHint')}</Text>
      )}
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
