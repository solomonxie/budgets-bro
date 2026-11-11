import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getDb } from '../db/client';
import {
  flushOnBackground,
  installPushDeps,
  noteLocalWrite,
  onRemoteChange,
  syncNow,
} from '../sync/browserSync';
import { useAppStore } from '../state/useAppStore';

// Same settle delay as useAutoCloudSync's first run: launch does no sync work.
const SETTLE_MS = 5000;

// Two-way browser sync (sync/browserSync.ts): pull when the app comes to
// the foreground, push 2 s after a write and when it backgrounds. No timers
// beyond those, no work while sync is off. Mounted once in DatabaseHooks.
export function useBrowserSync() {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const mounted = useRef(false);

  useEffect(() => {
    installPushDeps();
    const off = onRemoteChange(bumpDataVersion);
    const settle = setTimeout(() => void getDb().then(syncNow), SETTLE_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getDb().then(syncNow);
      else if (state === 'background') void getDb().then(flushOnBackground);
    });
    return () => {
      clearTimeout(settle);
      sub.remove();
      off();
    };
  }, [bumpDataVersion]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    void getDb().then(noteLocalWrite);
  }, [dataVersion]);
}
