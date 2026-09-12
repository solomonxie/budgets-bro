import * as SecureStore from 'expo-secure-store';

const AI_API_KEY = 'ai_api_key';

// Device-only, never in a backup: default Keychain accessibility
// (WHEN_UNLOCKED) rides along in iCloud/iTunes device backups and migrates
// to a new device on restore. THIS_DEVICE_ONLY opts out of both — these are
// provider credentials, not money data, so they must never leave this
// device via any backup path. The app's own backup/export (exportBoard.ts)
// never touches secureStore either way — only board-owned SQLite tables.
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const secureStore = {
  getAiApiKey: () => SecureStore.getItemAsync(AI_API_KEY),
  setAiApiKey: (value: string) => SecureStore.setItemAsync(AI_API_KEY, value, OPTIONS),
  clearAiApiKey: () => SecureStore.deleteItemAsync(AI_API_KEY),

  // Keyed by configId — one app install can hold several S3 buckets'
  // worth of credentials side by side (see sync/s3Provider.ts).
  getS3Credentials: async (configId: string) => {
    const [accessKeyId, secretAccessKey] = await Promise.all([
      SecureStore.getItemAsync(`s3_access_key_id_${configId}`),
      SecureStore.getItemAsync(`s3_secret_access_key_${configId}`),
    ]);
    return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : null;
  },
  setS3Credentials: (configId: string, accessKeyId: string, secretAccessKey: string) =>
    Promise.all([
      SecureStore.setItemAsync(`s3_access_key_id_${configId}`, accessKeyId, OPTIONS),
      SecureStore.setItemAsync(`s3_secret_access_key_${configId}`, secretAccessKey, OPTIONS),
    ]),
  clearS3Credentials: (configId: string) =>
    Promise.all([
      SecureStore.deleteItemAsync(`s3_access_key_id_${configId}`),
      SecureStore.deleteItemAsync(`s3_secret_access_key_${configId}`),
    ]),
};
