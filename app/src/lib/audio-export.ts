import { Asset } from 'expo-media-library';
import {
  cacheDirectory,
  deleteAsync,
  getInfoAsync,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { exportAudioToM4a } from 'playsz-native';

function safeBase(name: string): string {
  const trimmed = name.replace(/\.[^.]+$/, '');
  return trimmed.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'audio';
}

function filePath(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

/**
 * Remux the video's AAC audio track to an M4A file, then save it to the
 * media library (and offer a share sheet when available). Throws if the
 * source has no remuxable AAC track. Callers must not count a failure
 * against the free daily export cap.
 */
export async function exportVideoAudio(params: {
  sourceUri: string;
  title: string;
}): Promise<{ path: string; savedToLibrary: boolean }> {
  if (!cacheDirectory) {
    throw new Error('Temporary storage is not available on this platform.');
  }
  const destPath = `${cacheDirectory}${safeBase(params.title)}-${Date.now()}.m4a`;
  try {
    const output = await exportAudioToM4a(params.sourceUri, destPath);
    const outputUri = filePath(output);
    const info = await getInfoAsync(outputUri);
    if (!info.exists) {
      throw new Error('The audio export did not produce a file.');
    }

    let savedToLibrary = false;
    try {
      await Asset.create(outputUri);
      savedToLibrary = true;
    } catch {
      savedToLibrary = false;
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(outputUri, {
        mimeType: 'audio/mp4',
        dialogTitle: 'Save exported audio',
        UTI: 'com.apple.m4a-audio',
      });
    } else if (!savedToLibrary) {
      throw new Error(
        'The audio file was created, but it could not be saved to the library or shared.'
      );
    }
    return { path: outputUri, savedToLibrary };
  } catch (err) {
    await deleteAsync(destPath, { idempotent: true });
    throw err;
  }
}
