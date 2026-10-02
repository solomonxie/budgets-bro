import { useEffect } from 'react';
import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { useAppStore } from '../state/useAppStore';

const PAYEE_FIRST_KEY = 'spend_payee_first';

export function useBootstrapPayeeFirst() {
  const setPayeeFirst = useAppStore((s) => s.setPayeeFirst);
  useEffect(() => {
    (async () => {
      const db = await getDb();
      setPayeeFirst((await settingsRepo.getSetting(db, PAYEE_FIRST_KEY)) === '1');
    })();
  }, [setPayeeFirst]);
}

export async function savePayeeFirst(on: boolean): Promise<void> {
  useAppStore.getState().setPayeeFirst(on);
  const db = await getDb();
  await settingsRepo.setSetting(db, PAYEE_FIRST_KEY, on ? '1' : '0');
}
