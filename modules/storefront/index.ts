import { NativeModules } from 'react-native';

interface NativeStorefront {
  countryCode(): Promise<string | null>;
}

// See ios/StorefrontModule.swift.
const Storefront: NativeStorefront = NativeModules.Storefront;
export default Storefront;
