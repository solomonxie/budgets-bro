import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

export function useCalcForm(): CalcFormApi | null {
  return useContext(CalcFormContext);
}

const sameValues = (a: Values, b: Values) =>
  JSON.stringify(Object.entries(a).sort()) ===
  JSON.stringify(Object.entries(b).sort());

const isBlank = (values: Values) =>
  Object.values(values).every((text) => text.trim() === '');

// What each calculator was last filled with, so leaving and coming back
// doesn't mean typing a house price again. Reset files the current inputs
// under History instead of throwing them away. Per tool, not per board — a
// what-if isn't ledger data, so it sits in app_settings and stays out of
// backups.
export function CalcFormProvider({
  toolId,
  children,
}: {
  toolId: string;
  children: ReactNode;
}) {
  const valuesKey = `calc_form:${toolId}`;
  const historyKey = `calc_history:${toolId}`;
  const [values, setValues] = useState<Values | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      setHistory(await settingsRepo.getJsonSetting<Snapshot[]>(db, historyKey, []));
      setValues(await settingsRepo.getJsonSetting<Values>(db, valuesKey, {}));
    })();
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
      setValues((prev) => (prev?.[key] === text ? prev : { ...prev, [key]: text })),
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
  return <CalcFormContext.Provider value={api}>{children}</CalcFormContext.Provider>;
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
        style={({ pressed }) => [styles.reset, pressed && styles.pressed, empty && styles.off]}
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
                {Object.values(snapshot.values)
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
