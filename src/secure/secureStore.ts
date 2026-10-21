import * as Keychain from 'react-native-keychain';

// Device-only, never in a backup: the default Keychain accessibility
// (WHEN_UNLOCKED) rides along in iCloud/iTunes device backups and migrates
// to a new device on restore. THIS_DEVICE_ONLY opts out of both — these are
// provider credentials, not money data, so they must never leave this
// device via any backup path. The app's own backup/export (exportBoard.ts)
// never touches secureStore either way — only board-owned SQLite tables.
const OPTIONS = {
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;

// One Keychain "generic password" entry per key, addressed by `service`.
// The library stores a username/password pair; only the password carries
// anything, so the username is the key's own name — visible in a Keychain
// dump either way, and a label is friendlier there than an empty string.
async function read(service: string): Promise<string | null> {
  const found = await Keychain.getGenericPassword({ service });
  return found ? found.password : null;
}

async function write(service: string, value: string): Promise<void> {
  await Keychain.setGenericPassword(service, value, { service, ...OPTIONS });
}

async function clear(service: string): Promise<void> {
  await Keychain.resetGenericPassword({ service });
}

export const secureStore = {
  // Keyed by configId — one app install can hold several S3 buckets'
  // worth of credentials side by side (see sync/s3Provider.ts).
  getS3Credentials: async (configId: string) => {
    const [accessKeyId, secretAccessKey] = await Promise.all([
      read(`s3_access_key_id_${configId}`),
      read(`s3_secret_access_key_${configId}`),
    ]);
    return accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : null;
  },
  setS3Credentials: (
    configId: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) =>
    Promise.all([
      write(`s3_access_key_id_${configId}`, accessKeyId),
      write(`s3_secret_access_key_${configId}`, secretAccessKey),
    ]),
  clearS3Credentials: (configId: string) =>
    Promise.all([
      clear(`s3_access_key_id_${configId}`),
      clear(`s3_secret_access_key_${configId}`),
    ]),
};
