import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { useAppStore } from '../state/useAppStore';
import type { LockMode } from '../secure/appLock';

const LOCK_MODE_KEY = 'app_lock_mode';

export async function readLockMode(): Promise<LockMode> {
  const db = await getDb();
  const saved = await settingsRepo.getSetting(db, LOCK_MODE_KEY);
  return saved === 'passcode' || saved === 'biometric' ? saved : 'none';
}

export async function writeLockMode(mode: LockMode): Promise<void> {
  const db = await getDb();
  await settingsRepo.setSetting(db, LOCK_MODE_KEY, mode);
}

// Owns both halves of the gate:
// - `locked`: needs the user to prove who they are before the app is usable
//   — on cold start, and on every return from the background.
// - `covered`: hide the ledger without asking anything — the app isn't
//   frontmost, so this is also what iOS photographs for the app switcher.
export function useAppLock() {
  const lockMode = useAppStore((s) => s.lockMode);
  const setLockMode = useAppStore((s) => s.setLockMode);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(false);
  // Only a real trip to the background re-locks. 'inactive' fires for things
  // that never left the app — the app switcher being *peeked* at, Control
  // Centre, a system alert, and the Face ID sheet this very lock puts up —
  // and treating those as leaving would ask again the instant it finished
  // asking.
  const wasBackgrounded = useRef(false);

  useEffect(() => {
    (async () => {
      const mode = await readLockMode();
      setLockMode(mode);
      setLocked(mode !== 'none');
      setReady(true);
    })();
  }, [setLockMode]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const returning = wasBackgrounded.current;
        wasBackgrounded.current = false;
        setCovered(false);
        if (lockMode !== 'none' && returning) setLocked(true);
        return;
      }
      if (state === 'background') wasBackgrounded.current = true;
      // The cover goes down on 'inactive' too: that is the state the app is
      // in when iOS photographs it for the app switcher.
      if (lockMode !== 'none') setCovered(true);
    });
    return () => sub.remove();
  }, [lockMode]);

  const unlock = useCallback(() => {
    wasBackgrounded.current = false;
    setLocked(false);
    setCovered(false);
  }, []);

  return {
    mode: lockMode,
    // Nothing is shown before the saved mode is known — otherwise a locked
    // app flashes its ledger for one frame on every cold start.
    showGate: !ready || locked || covered,
    needsAuth: ready && locked,
    unlock,
  };
}
