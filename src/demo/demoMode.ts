import { getDb, setDemoMode } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';
import * as boardsRepo from '../db/repositories/boardsRepo';
import { seedDemoBoard } from '../db/seed/demoBoard';
import { ACTIVE_BOARD_KEY, FIRST_RUN_DONE_KEY } from '../hooks/useBoards';
import { LANGUAGE_KEY } from '../hooks/useLanguage';

const DEMO_SEEDED_KEY = 'demo_seeded';
// Carried into the demo database so AI and language work the same there.
// AI key secrets live in the Keychain, shared by id; only the list is copied.
const CARRIED_KEYS = ['ai_keys', 'ai_key_strategy', LANGUAGE_KEY];

export async function enterDemoMode(): Promise<void> {
  const real = await getDb();
  const carried = await Promise.all(CARRIED_KEYS.map((k) => settingsRepo.getSetting(real, k)));
  await setDemoMode(true);
  const demo = await getDb();
  for (const [i, key] of CARRIED_KEYS.entries()) {
    const value = carried[i];
    if (value != null) await settingsRepo.setSetting(demo, key, value);
  }
  if (await settingsRepo.getSetting(demo, DEMO_SEEDED_KEY)) return;
  const before = await boardsRepo.listBoards(demo);
  const boardId = await seedDemoBoard(demo);
  for (const board of before) {
    if (await boardsRepo.isBoardUnused(demo, board.id)) await boardsRepo.deleteBoard(demo, board.id);
  }
  await settingsRepo.setSetting(demo, ACTIVE_BOARD_KEY, String(boardId));
  await settingsRepo.setSetting(demo, FIRST_RUN_DONE_KEY, '1');
  await settingsRepo.setSetting(demo, DEMO_SEEDED_KEY, '1');
}

export const leaveDemoMode = () => setDemoMode(false);
