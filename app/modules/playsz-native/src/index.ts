import { requireNativeModule } from 'expo-modules-core';

type PlayszNativeModuleType = {
  exportAudioToM4a(sourceUri: string, destPath: string): Promise<string>;
  exportEncryptedArchive(
    sourceDir: string,
    destPath: string,
    password: string
  ): Promise<string>;
  importEncryptedArchive(
    archivePath: string,
    destDir: string,
    password: string
  ): Promise<number>;
};

const native = requireNativeModule<PlayszNativeModuleType>('PlayszNative');

export async function exportAudioToM4a(
  sourceUri: string,
  destPath: string
): Promise<string> {
  return native.exportAudioToM4a(sourceUri, destPath);
}

export async function exportEncryptedArchive(
  sourceDir: string,
  destPath: string,
  password: string
): Promise<string> {
  return native.exportEncryptedArchive(sourceDir, destPath, password);
}

export async function importEncryptedArchive(
  archivePath: string,
  destDir: string,
  password: string
): Promise<number> {
  return native.importEncryptedArchive(archivePath, destDir, password);
}
