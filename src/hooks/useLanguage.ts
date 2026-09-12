import { useCallback, useEffect } from 'react';
import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { useAppStore } from '../state/useAppStore';
import type { Language } from '../i18n';

const LANGUAGE_KEY = 'language_preference';

// Restores the saved language once near the app root — same pattern as
// useBoards' useBootstrapActiveBoard.
export function useBootstrapLanguage() {
  const setLanguage = useAppStore((s) => s.setLanguage);
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const saved = await settingsRepo.getSetting(db, LANGUAGE_KEY);
      if (saved === 'en' || saved === 'zh') setLanguage(saved);
    })();
  }, [setLanguage]);
}

export function useLanguageSetting() {
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);

  const selectLanguage = useCallback(
    async (next: Language) => {
      setLanguage(next);
      const db = await getDb();
      await settingsRepo.setSetting(db, LANGUAGE_KEY, next);
    },
    [setLanguage],
  );

  return { language, selectLanguage };
}
