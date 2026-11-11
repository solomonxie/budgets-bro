import { hlcOfCheckpointKey } from './codec';
import { parse } from './clock';
import type { CheckpointEntity } from './types';

// Who publishes the next checkpoint, decided the same way on every device
// from what it can see without downloading anyone's checkpoint.

export const checkpointIntervalMs = 86_400_000;

// Newest hlc among listed `sync/checkpoints/` keys, or null when none.
export function newestCheckpointHlc(keys: string[]): string | null {
  let newest: string | null = null;
  for (const key of keys) {
    const h = hlcOfCheckpointKey(key);
    if (h && (newest === null || h > newest)) newest = h;
  }
  return newest;
}

// Due when there is none yet, or the newest is a day old in bucket time.
export const checkpointDue = (newest: string | null, bucketNow: number): boolean =>
  newest === null || bucketNow - parse(newest).wall >= checkpointIntervalMs;

// The device with the most winning field values stamped after `since`;
// ties go to the smallest device id. Null when nothing is newer.
export function checkpointPublisher(lines: CheckpointEntity[], since: string | null): string | null {
  const counts = new Map<string, number>();
  for (const line of lines) {
    for (const v of Object.values(line.f)) {
      const at = v.s.indexOf('@');
      if (since !== null && v.s.slice(0, at) <= since) continue;
      const d = v.s.slice(at + 1);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let most = 0;
  for (const [d, n] of counts) {
    if (n > most || (n === most && best !== null && d < best)) {
      best = d;
      most = n;
    }
  }
  return best;
}
