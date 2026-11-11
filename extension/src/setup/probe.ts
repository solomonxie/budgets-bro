import type { Bucket } from '../../../sync-core/bucket';

// What is under the prefix. 'ready': the phone has published a checkpoint.
// 'waiting': it's the phone's bucket (daily zips or a started log) but no
// checkpoint yet. 'empty': nothing of Budgets Bro's — likely a wrong folder.
export type BucketState = 'ready' | 'waiting' | 'empty';

export async function probe(bucket: Bucket): Promise<BucketState> {
  if ((await bucket.list('sync/checkpoints/', { max: 1 })).length > 0) return 'ready';
  if ((await bucket.list('sync/', { max: 1 })).length > 0) return 'waiting';
  // Daily zips sit at the prefix root and sort before `sync/`.
  const root = await bucket.list('', { max: 50 });
  return root.some((o) => o.key.endsWith('.zip')) ? 'waiting' : 'empty';
}
