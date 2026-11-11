import type { SyncEngine } from './engine';

const QUIET_MS = 2000;

// Sync on open, on focus or becoming visible, and 2 s after the last edit.
// Hidden: the pending edits are sent at once and no timer is left running.
export function startTriggers(engine: SyncEngine, quietMs = QUIET_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const visible = () => document.visibilityState === 'visible';
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const run = () => {
    cancel();
    void engine.sync();
  };
  const onVisibility = () => {
    if (visible()) return run();
    cancel();
    void engine.flush();
  };
  engine.onEdit = () => {
    cancel();
    if (visible()) timer = setTimeout(run, quietMs);
    else void engine.flush();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', run);
  run();
  return () => {
    cancel();
    engine.onEdit = () => {};
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', run);
  };
}
