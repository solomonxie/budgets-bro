import Storefront from '../../modules/storefront';

let china: Promise<boolean> | null = null;

// The App Store country decides, not the device language or region: China
// App Review rejects any foreign model it can see.
export function isChinaStorefront(): Promise<boolean> {
  china ??= (Storefront?.countryCode() ?? Promise.resolve(null)).then((c) => c === 'CHN').catch(() => false);
  return china;
}
