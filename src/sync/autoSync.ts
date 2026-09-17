// Its own module, not a helper inside cloudSync.ts, only so it can be tested:
// importing cloudSync pulls in the S3 provider and with it @noble/hashes,
// which this project's jest setup can't transform.

// One switch per destination now. It used to be two settings — "is this
// destination on" and "auto-sync to it" — plus a global auto-sync switch
// above both, and no combination of the three said anything a user could
// predict. This resolves the single switch against whatever that pair had
// stored, so nobody's existing choice flips underneath them on upgrade:
//
//   own            this destination's own switch, once it's been touched
//   legacyEnabled  its old "keep a copy here" flag, where it had one
//   legacyGlobal   the single auto-sync switch that preceded all of this
//   fallback       what a destination starts as when nothing was ever stored
export function resolveSyncEnabled(
  own: string | null,
  legacyEnabled: string | null,
  legacyGlobal: string | null,
  fallback: boolean,
): boolean {
  if (own != null) return own === 'true';
  if (legacyGlobal === 'false') return false;
  if (legacyEnabled != null) return legacyEnabled === 'true';
  return fallback;
}
