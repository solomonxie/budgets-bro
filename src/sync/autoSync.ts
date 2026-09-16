// Its own module, not a helper inside cloudSync.ts, only so it can be tested:
// importing cloudSync pulls in the S3 provider and with it @noble/hashes,
// which this project's jest setup can't transform.

// Auto-sync is per destination. This resolves one destination's setting
// against the single global switch it replaced: a destination with nothing of
// its own inherits the old value, so anyone who had turned sync off does not
// silently start syncing again. On only when neither was ever written.
export function resolveAutoSync(own: string | null, legacyGlobal: string | null): boolean {
  if (own != null) return own === 'true';
  return legacyGlobal !== 'false';
}
