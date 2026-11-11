// chrome.i18n, with the key itself as a fallback (tests, a missing string).
export const t = (key: string, ...subs: (string | number)[]): string => {
  const s = typeof chrome !== 'undefined' && chrome.i18n ? chrome.i18n.getMessage(key, subs.map(String)) : '';
  return s || key;
};
