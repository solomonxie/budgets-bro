import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PasscodeEntry } from '../../components/ui/PasscodeEntry';
import { useAppLock } from '../../hooks/useAppLock';
import { authenticateBiometric, verifyPasscode } from '../../secure/appLock';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// A full-screen Modal rather than a screen the app navigates to: the ledger
// underneath keeps its place, nothing has to unmount, and being the last
// Modal presented is the only way to cover the ones already up (Settings and
// the account sheet are Modals themselves, and an absolutely-positioned View
// in the root tree would sit behind them). It is also what iOS photographs
// for the app switcher — see useAppLock's `covered`.
export function LockGate() {
  const t = useT();
  const { mode, showGate, needsAuth, unlock } = useAppLock();
  const [error, setError] = useState<string | null>(null);
  const [prompting, setPrompting] = useState(false);

  const promptBiometric = useCallback(async () => {
    setPrompting(true);
    const ok = await authenticateBiometric(t('lock.biometricPrompt'));
    setPrompting(false);
    if (ok) {
      setError(null);
      unlock();
    } else {
      setError(t('lock.biometricFailed'));
    }
  }, [t, unlock]);

  // Asks the moment the lock appears, so the usual case is a glance and the
  // app is open — the button below is only for a face it didn't recognise.
  useEffect(() => {
    if (needsAuth && mode === 'biometric') promptBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAuth, mode]);

  const submitPasscode = async (passcode: string) => {
    if (await verifyPasscode(passcode)) {
      setError(null);
      unlock();
    } else {
      setError(t('lock.passcodeWrong'));
    }
  };

  return (
    <Modal
      visible={showGate}
      animationType="none"
      presentationStyle="fullScreen"
      // Nothing to request-close to: there is no dismissing this without
      // unlocking, including by the hardware back button on Android.
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
      {needsAuth ? (
        mode === 'passcode' ? (
          <PasscodeEntry
            title={t('lock.passcodeTitle')}
            error={error}
            onComplete={submitPasscode}
          />
        ) : (
          <View style={styles.biometric}>
            <Text style={styles.title}>{t('lock.biometricTitle')}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              disabled={prompting}
              style={styles.unlockButton}
              onPress={promptBiometric}
            >
              <Text style={styles.unlockText}>{t('lock.unlock')}</Text>
            </Pressable>
          </View>
        )
      ) : (
        // Covered, not locked: the app is simply not frontmost, and asking
        // for anything here would be asking the app switcher.
          <Text style={styles.title}>{t('lock.appName')}</Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  biometric: { alignItems: 'center', gap: spacing.md },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  error: { fontSize: 13, color: colors.negative, textAlign: 'center' },
  unlockButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  unlockText: { fontSize: 15, fontWeight: '700', color: colors.accent },
});
