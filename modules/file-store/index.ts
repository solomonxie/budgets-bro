import { NativeModules } from 'react-native';

export interface NativeFileEntry {
  name: string;
  path: string;
  isFile: boolean;
  size: number;
  mtime?: number; // ms since epoch
}

interface NativeFileStore {
  documentDir: string;
  cacheDir: string;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  readDir(path: string): Promise<NativeFileEntry[]>;
  readBase64(path: string): Promise<string>;
  writeBase64(path: string, base64: string): Promise<void>;
  remove(path: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
}

// See ios/FileStoreModule.swift.
const FileStore: NativeFileStore = NativeModules.FileStore;
export default FileStore;
