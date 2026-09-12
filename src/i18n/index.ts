import { useAppStore } from '../state/useAppStore';
import { en } from './en';
import { zh } from './zh';

export type Language = 'en' | 'zh';
export type TranslationKey = keyof typeof en;

export const LANGUAGES: { code: Language; labelKey: TranslationKey }[] = [
  { code: 'en', labelKey: 'settings.languageEnglish' },
  { code: 'zh', labelKey: 'settings.languageChinese' },
];

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, zh };

// Intl locale tag for date/number formatting (domain/month.ts's
// formatMonthLabel etc.) — separate from the translation dictionary since
// not every formatted value goes through a translation key.
export function localeTag(language: Language): string {
  return language === 'zh' ? 'zh-CN' : 'en-US';
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

export function useI18n() {
  const language = useAppStore((s) => s.language);
  const dict = dictionaries[language];
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => interpolate(dict[key], vars);
  return { t, language };
}

// Convenience for the common case of only needing the translate function.
export function useT() {
  return useI18n().t;
}
