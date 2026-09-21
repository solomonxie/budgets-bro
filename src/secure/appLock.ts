import * as Keychain from 'react-native-keychain';

export type LockMode = 'none' | 'passcode' | 'biometric';

export const PASSCODE_LENGTH = 4;

const PASSCODE_SERVICE = 'app_lock_passcode';
const BIOMETRIC_SERVICE = 'app_lock_biometric';
const BIOMETRIC_MARKER = 'unlocked';

// The passcode is stored as typed, not hashed. Hashing four digits is
// theatre — ten thousand candidates fall in milliseconds — so the thing
// actually protecting it is where it lives: a device-only Keychain entry,
// encrypted by iOS, excluded from every backup (same options as the AI/S3
// credentials next door in secureStore.ts).
const OPTIONS = {
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;

export async function setPasscode(passcode: string): Promise<void> {
  await Keychain.setGenericPassword(PASSCODE_SERVICE, passcode, {
    service: PASSCODE_SERVICE,
    ...OPTIONS,
  });
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  const found = await Keychain.getGenericPassword({
    service: PASSCODE_SERVICE,
  });
  return found !== false && found.password === passcode;
}

export async function hasPasscode(): Promise<boolean> {
  const found = await Keychain.getGenericPassword({
    service: PASSCODE_SERVICE,
  });
  return found !== false;
}

// Face ID / Touch ID, named by what this phone actually has — an iPhone SE
// says Touch ID, and a phone with neither enrolled says nothing at all, so
// the setting can refuse instead of offering a lock that can't open.
export async function biometryName(): Promise<string | null> {
  const type = await Keychain.getSupportedBiometryType();
  if (type === Keychain.BIOMETRY_TYPE.FACE_ID) return 'Face ID';
  if (type === Keychain.BIOMETRY_TYPE.TOUCH_ID) return 'Touch ID';
  return type ? 'Biometrics' : null;
}

// There is no "authenticate" call to make on its own: the prompt is a side
// effect of reading a Keychain entry that was written behind it. So the
// lock is a marker value written under BIOMETRY_ANY_OR_DEVICE_PASSCODE —
// unlocking means reading it back, and the passcode fallback is the OS's,
// which means a failed face (a mask, a dark room, a bandage) can never lock
// someone out of their own ledger.
export async function enableBiometricLock(): Promise<void> {
  await Keychain.setGenericPassword(BIOMETRIC_SERVICE, BIOMETRIC_MARKER, {
    service: BIOMETRIC_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  });
}

export async function authenticateBiometric(prompt: string): Promise<boolean> {
  try {
    const found = await Keychain.getGenericPassword({
      service: BIOMETRIC_SERVICE,
      authenticationPrompt: { title: prompt },
    });
    return found !== false && found.password === BIOMETRIC_MARKER;
  } catch {
    // Cancelled, failed, or no longer enrolled — all one answer here.
    return false;
  }
}

export async function clearPasscode(): Promise<void> {
  await Keychain.resetGenericPassword({ service: PASSCODE_SERVICE });
}

export async function clearLockSecrets(): Promise<void> {
  await Promise.all([
    Keychain.resetGenericPassword({ service: PASSCODE_SERVICE }),
    Keychain.resetGenericPassword({ service: BIOMETRIC_SERVICE }),
  ]);
}
