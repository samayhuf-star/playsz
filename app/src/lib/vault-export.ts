import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import {
  cacheDirectory,
  readDirectoryAsync,
} from 'expo-file-system/legacy';
import {
  exportEncryptedArchive,
  importEncryptedArchive,
} from 'playsz-native';

import {
  privateFolderDir,
  registerImportedPrivateFiles,
} from '@/lib/private-folder';

export async function shareEncryptedPrivateFolder(
  password: string
): Promise<string> {
  if (!cacheDirectory) {
    throw new Error('Temporary storage is not available on this platform.');
  }
  const destPath = `${cacheDirectory}playsz-private-${Date.now()}.playszenc`;
  const output = await exportEncryptedArchive(
    privateFolderDir(),
    destPath,
    password
  );
  const outputUri = output.startsWith('file://') ? output : `file://${output}`;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(outputUri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Save encrypted private-folder archive',
    });
  }
  return outputUri;
}

export async function importEncryptedPrivateFolder(params: {
  password: string;
  isPro: boolean;
}): Promise<{ added: number; count: number; cap: number }> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]?.uri) {
    throw new Error('cancelled');
  }
  const destDir = privateFolderDir();
  await importEncryptedArchive(picked.assets[0].uri, destDir, params.password);
  const names = await readDirectoryAsync(destDir);
  return registerImportedPrivateFiles(names, params.isPro);
}
