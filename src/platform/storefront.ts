import Storefront from '../../modules/storefront';

let china: Promise<boolean> | null = null;

// The App Store country, for a first-run language guess: a China store
// install opens in Chinese until the user picks.
export function isChinaStorefront(): Promise<boolean> {
  china ??= (Storefront?.countryCode() ?? Promise.resolve(null)).then((c) => c === 'CHN').catch(() => false);
  return china;
}
