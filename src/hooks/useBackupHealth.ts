import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db/client';
import { getBackupHealth } from '../sync/backupHealth';
import type { BackupHealth } from '../sync/backupHealth';
import { useT } from '../i18n';

// Every mounted reader re-reads when a sync finishes, so a banner raised a
// moment before the first backup landed doesn't linger.
const listeners = new Set<() => void>();
export function notifyBackupFinished(): void {
  listeners.forEach((listener) => listener());
}

// Read when the screen comes into view and when the app returns to the
// foreground — the two moments the answer can have changed (a sync just ran,
// iCloud Drive was switched back on in iOS Settings). No polling.
export function useBackupHealth(): [BackupHealth | null, () => Promise<void>] {
  const t = useT();
  const [health, setHealth] = useState<BackupHealth | null>(null);
  const icloudLabel = t('backup.icloud');

  const refresh = useCallback(async () => {
    try {
      setHealth(await getBackupHealth(await getDb(), icloudLabel));
    } catch (e) {
      console.warn('[backupHealth] failed', e);
    }
  }, [icloudLabel]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return [health, refresh];
}
