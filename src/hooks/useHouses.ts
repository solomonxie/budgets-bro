import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as housesRepo from '../db/repositories/housesRepo';
import type { House, HouseInput } from '../db/repositories/housesRepo';
import { useAppStore } from '../state/useAppStore';

export function useHouses() {
  const boardId = useAppStore((s) => s.currentBoardId);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [houses, setHouses] = useState<House[]>([]);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setHouses(await housesRepo.listHouses(db, boardId));
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const add = useCallback(
    async (input: HouseInput) => {
      const db = await getDb();
      const id = await housesRepo.createHouse(db, boardId, input);
      bumpDataVersion();
      return id;
    },
    [boardId, bumpDataVersion],
  );

  const update = useCallback(
    async (id: number, input: HouseInput) => {
      const db = await getDb();
      await housesRepo.updateHouse(db, id, input);
      bumpDataVersion();
    },
    [bumpDataVersion],
  );

  const remove = useCallback(
    async (id: number) => {
      const db = await getDb();
      await housesRepo.deleteHouse(db, id);
      bumpDataVersion();
    },
    [bumpDataVersion],
  );

  return { houses, refresh, add, update, remove };
}
