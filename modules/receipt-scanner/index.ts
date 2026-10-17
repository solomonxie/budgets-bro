import { NativeModules } from 'react-native';

export interface ScannedText {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface NativeReceiptScanner {
  scan(source: 'camera' | 'library'): Promise<ScannedText[] | null>;
}

// See ios/ReceiptScannerModule.swift.
const ReceiptScanner: NativeReceiptScanner = NativeModules.ReceiptScanner;
export default ReceiptScanner;
