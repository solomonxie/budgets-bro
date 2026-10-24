import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../../db/client';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import { localeTag, useI18n } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const HISTORY_LIMIT = 10;

type Values = Record<string, string>;

interface Snapshot {
  at: string;
  values: Values;
}

interface CalcFormApi {
  values: Values;
  set: (key: string, text: string) => void;
  history: Snapshot[];
  reset: () => void;
  restore: (snapshot: Snapshot) => void;
}

const CalcFormContext = createContext<CalcFormApi | null>(null);

// A remembered choice — a unit, a province, a toggle — kept with the typed
// fields so a form comes back exactly as it was left.
export function useCalcChoice<T extends string>(
  key: string,
  initial: T,
): [T, (next: T) => void] {
  const form = useContext(CalcFormContext);
  const [local, setLocal] = useState<T>(initial);
  const value = form
    ? ((form.values[`@${key}`] as T | undefined) ?? initial)
    : local;
  // On the provider's stable `set`, not the form object, so a memoized
  // child isn't handed a new setter on every keystroke.
  const formSet = form?.set;
  const set = useCallback(
    (next: T) => (formSet ? formSet(`@${key}`, next) : setLocal(next)),
    [formSet, key],
  );
  return [value, set];
}

export function useCalcForm(): CalcFormApi | null {
  return useContext(CalcFormContext);
}

const sameValues = (a: Values, b: Values) =>
  JSON.stringify(Object.entries(a).sort()) ===
  JSON.stringify(Object.entries(b).sort());

// Keys starting with "@" hold choices (a unit, a province) rather than typed
// text: kept with the inputs, but they don't make a form "filled in".
const typedEntries = (values: Values) =>
  Object.entries(values).filter(([key]) => !key.startsWith('@'));

const isBlank = (values: Values) =>
  typedEntries(values).every(([, text]) => text.trim() === '');

// What each calculator was last filled with, so leaving and coming back
// doesn't mean typing a house price again. Reset files the current inputs
// under History instead of throwing them away. Per tool, not per board — a
// what-if isn't ledger data, so it sits in app_settings and stays out of
// backups.
export function CalcFormProvider({
  toolId,
  seed,
  children,
}: {
  toolId: string;
  /** Fills a never-used form, e.g. from a tool this one replaced. */
  seed?: () => Promise<Values | null>;
  children: ReactNode;
}) {
  const valuesKey = `calc_form:${toolId}`;
  const historyKey = `calc_history:${toolId}`;
  const [values, setValues] = useState<Values | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      setHistory(
        await settingsRepo.getJsonSetting<Snapshot[]>(db, historyKey, []),
      );
      const saved = await settingsRepo.getJsonSetting<Values | null>(
        db,
        valuesKey,
        null,
      );
      setValues(saved ?? (seed ? ((await seed()) ?? {}) : {}));
    })();
    // The seed only matters on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey, historyKey]);

  useEffect(() => {
    if (values == null) return;
    (async () => {
      const db = await getDb();
      await settingsRepo.setJsonSetting(db, valuesKey, values);
    })();
  }, [values, valuesKey]);

  const set = useCallback(
    (key: string, text: string) =>
      setValues((prev) =>
        prev?.[key] === text ? prev : { ...prev, [key]: text },
      ),
    [],
  );

  const file = (current: Values | null) => {
    if (current == null || isBlank(current)) return history;
    const next = [
      { at: new Date().toISOString(), values: current },
      ...history.filter((h) => !sameValues(h.values, current)),
    ].slice(0, HISTORY_LIMIT);
    setHistory(next);
    (async () => {
      const db = await getDb();
      await settingsRepo.setJsonSetting(db, historyKey, next);
    })();
    return next;
  };

  if (values == null) return null;

  const api: CalcFormApi = {
    values,
    set,
    history,
    reset: () => {
      file(values);
      setValues({});
    },
    restore: (snapshot) => {
      file(values);
      setValues(snapshot.values);
    },
  };
  return (
    <CalcFormContext.Provider value={api}>{children}</CalcFormContext.Provider>
  );
}

export function CalcFormFooter() {
  const { t, language } = useI18n();
  const form = useCalcForm();
  if (form == null) return null;
  const empty = isBlank(form.values);
  const locale = localeTag(language);
  return (
    <View style={styles.footer}>
      <Pressable
        style={({ pressed }) => [
          styles.reset,
          pressed && styles.pressed,
          empty && styles.off,
        ]}
        onPress={form.reset}
        disabled={empty}
      >
        <Text style={styles.resetText}>{t('financeTools.reset')}</Text>
      </Pressable>
      {form.history.length > 0 ? (
        <>
          <Text style={styles.heading}>{t('financeTools.history')}</Text>
          <Text style={styles.hint}>{t('financeTools.historyHint')}</Text>
          {form.history.map((snapshot) => (
            <Pressable
              key={snapshot.at}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              onPress={() => form.restore(snapshot)}
            >
              <Text style={styles.when}>
                {new Date(snapshot.at).toLocaleString(locale, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
              <Text style={styles.preview} numberOfLines={1}>
                {typedEntries(snapshot.values)
                  .map(([, text]) => text)
                  .filter((text) => text.trim() !== '')
                  .join(' · ')}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm, marginTop: spacing.md },
  reset: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetText: { fontSize: 15, fontWeight: '600', color: colors.negative },
  off: { opacity: 0.4 },
  pressed: { backgroundColor: colors.surface },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  hint: { fontSize: 12, color: colors.textMuted },
  item: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  when: { fontSize: 13, fontWeight: '600', color: colors.text },
  preview: { fontSize: 12, color: colors.textMuted },
});
