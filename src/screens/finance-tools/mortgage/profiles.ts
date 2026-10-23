import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../../../db/client';
import * as settingsRepo from '../../../db/repositories/settingsRepo';

const LIST_KEY = 'mortgage_profiles';
const ACTIVE_KEY = 'mortgage_profile_active';

export interface SimulationProfile {
  id: string;
  name: string;
}

// Each profile's inputs live in their own calc form; this is the list and
// which one is open. Real mortgage accounts are profiles too, but come from
// the accounts list rather than from here, so they can't be removed.
export function useSimulationProfiles(defaultName: (n: number) => string) {
  const [profiles, setProfiles] = useState<SimulationProfile[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      let list = await settingsRepo.getJsonSetting<SimulationProfile[]>(
        db,
        LIST_KEY,
        [],
      );
      // Named "Plan n" before they were called simulations.
      const renamed = list.map((p) => {
        const n = /^(?:Plan|方案) (\d+)$/.exec(p.name)?.[1];
        return n ? { ...p, name: defaultName(Number(n)) } : p;
      });
      if (renamed.some((p, i) => p !== list[i])) {
        list = renamed;
        await settingsRepo.setJsonSetting(db, LIST_KEY, list);
      }
      if (list.length === 0) {
        list = [{ id: newId(), name: defaultName(1) }];
        await settingsRepo.setJsonSetting(db, LIST_KEY, list);
      }
      setProfiles(list);
      setActiveId(await settingsRepo.getSetting(db, ACTIVE_KEY));
    })();
    // Read once; the name is only for a first-ever profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveList = useCallback(async (next: SimulationProfile[]) => {
    setProfiles(next);
    await settingsRepo.setJsonSetting(await getDb(), LIST_KEY, next);
  }, []);

  const open = useCallback(async (id: string) => {
    setActiveId(id);
    await settingsRepo.setSetting(await getDb(), ACTIVE_KEY, id);
  }, []);

  /** A new profile: blank, a copy of another's inputs, or given values. */
  const add = useCallback(
    async (start?: {
      copyFromFormKey?: string;
      values?: Record<string, string>;
      name?: string;
    }) => {
      if (!profiles) return;
      const profile = {
        id: newId(),
        name: start?.name ?? defaultName(profiles.length + 1),
      };
      const db = await getDb();
      const values = start?.copyFromFormKey
        ? await settingsRepo.getJsonSetting(
            db,
            `calc_form:${start.copyFromFormKey}`,
            {},
          )
        : start?.values;
      if (values)
        await settingsRepo.setJsonSetting(
          db,
          `calc_form:${formKey(profile.id)}`,
          values,
        );
      await saveList([...profiles, profile]);
      await open(profile.id);
    },
    [profiles, saveList, open, defaultName],
  );

  const rename = useCallback(
    (id: string, name: string) =>
      profiles &&
      saveList(profiles.map((p) => (p.id === id ? { ...p, name } : p))),
    [profiles, saveList],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!profiles || profiles.length <= 1) return;
      const db = await getDb();
      await settingsRepo.setJsonSetting(db, `calc_form:${formKey(id)}`, null);
      await settingsRepo.setJsonSetting(
        db,
        `calc_history:${formKey(id)}`,
        null,
      );
      await saveList(profiles.filter((p) => p.id !== id));
    },
    [profiles, saveList],
  );

  return { profiles, activeId, open, add, rename, remove };
}

export function formKey(profileId: string): string {
  return `mortgage:${profileId}`;
}

export function accountProfileId(accountId: number): string {
  return `account-${accountId}`;
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
