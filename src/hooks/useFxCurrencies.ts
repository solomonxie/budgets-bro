import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';

const KEY = 'fx_currencies';

interface FxSelection {
  codes: string[];
  focused: string;
}

const DEFAULT: FxSelection = {
  codes: ['CAD', 'USD', 'CNY'],
  focused: 'CAD',
};

// The row of currencies the converter shows, in the order the user put them
// in, and which one they were last typing into. Not board data — it is a
// preference about a page, so it sits in app_settings beside the language
// and the lock mode, and a backup has no reason to carry it.
export function useFxCurrencies() {
  const [selection, setSelection] = useState<FxSelection>(DEFAULT);
  // The defaults are what renders until the saved row arrives — `ready` is
  // for a caller that must not mistake that first frame for a choice.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const saved = await settingsRepo.getJsonSetting<FxSelection>(
        db,
        KEY,
        DEFAULT,
      );
      if (saved.codes.length > 0) setSelection(saved);
      setReady(true);
    })();
  }, []);

  const save = useCallback(async (next: FxSelection) => {
    setSelection(next);
    const db = await getDb();
    await settingsRepo.setJsonSetting(db, KEY, next);
  }, []);

  const add = useCallback(
    (code: string) => {
      if (selection.codes.includes(code)) return;
      save({ ...selection, codes: [...selection.codes, code] });
    },
    [selection, save],
  );

  // Removing the row being typed into hands the focus to whatever takes its
  // place in the list, so the page never has an amount belonging to nothing.
  const remove = useCallback(
    (code: string) => {
      if (selection.codes.length <= 1) return;
      const index = selection.codes.indexOf(code);
      const codes = selection.codes.filter((c) => c !== code);
      save({
        codes,
        focused:
          selection.focused === code
            ? codes[Math.min(index, codes.length - 1)]
            : selection.focused,
      });
    },
    [selection, save],
  );

  const move = useCallback(
    (code: string, delta: number) => {
      const from = selection.codes.indexOf(code);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= selection.codes.length) return;
      const codes = [...selection.codes];
      [codes[from], codes[to]] = [codes[to], codes[from]];
      save({ ...selection, codes });
    },
    [selection, save],
  );

  const focus = useCallback(
    (code: string) => {
      if (code !== selection.focused) save({ ...selection, focused: code });
    },
    [selection, save],
  );

  return {
    codes: selection.codes,
    focused: selection.focused,
    ready,
    add,
    remove,
    move,
    focus,
  };
}
