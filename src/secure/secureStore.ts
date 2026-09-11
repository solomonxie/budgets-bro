import * as SecureStore from 'expo-secure-store';

const AI_API_KEY = 'ai_api_key';
const S3_ACCESS_KEY_ID = 's3_access_key_id';
const S3_SECRET_ACCESS_KEY = 's3_secret_access_key';

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

  getS3Credentials: async () => {
    const [accessKeyId, secretAccessKey] = await Promise.all([
      SecureStore.getItemAsync(S3_ACCESS_KEY_ID),
      SecureStore.getItemAsync(S3_SECRET_ACCESS_KEY),
    ]);
    return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : null;
  },
  setS3Credentials: (accessKeyId: string, secretAccessKey: string) =>
    Promise.all([
      SecureStore.setItemAsync(S3_ACCESS_KEY_ID, accessKeyId, OPTIONS),
      SecureStore.setItemAsync(S3_SECRET_ACCESS_KEY, secretAccessKey, OPTIONS),
    ]),
  clearS3Credentials: () =>
    Promise.all([
      SecureStore.deleteItemAsync(S3_ACCESS_KEY_ID),
      SecureStore.deleteItemAsync(S3_SECRET_ACCESS_KEY),
    ]),
};
