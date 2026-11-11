// One sync step at a time: sealing, pulling and pushing all write sync state,
// and the driver runs every caller on one connection with no queue of its
// own. Pull and push both enter through here.
let tail: Promise<unknown> = Promise.resolve();

export function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => {});
  return run;
}
