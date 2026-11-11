import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import {
  documentDirectory,
  makeDirectoryAsync,
  getInfoAsync,
  copyAsync,
  readAsStringAsync,
} from 'expo-file-system/legacy';

import { parseSubtitleFile, type SubtitleCue } from '@/lib/subtitles';

export type SubtitleSelection = {
  name: string;
  storedUri: string;
  offset: number;
};

const PREFIX = 'playsz:subtitles:';

function keyFor(assetId: string): string {
  return `${PREFIX}${assetId}`;
}

function subtitleDir(): string {
  if (!documentDirectory) {
    throw new Error('App-private storage is not available on this platform.');
  }
  return `${documentDirectory}subtitles/`;
}

export async function loadSubtitleSelection(
  assetId: string
): Promise<{ selection: SubtitleSelection; cues: SubtitleCue[] } | null> {
  if (!assetId) {
    return null;
  }
  const raw = await AsyncStorage.getItem(keyFor(assetId));
  if (!raw) {
    return null;
  }
  try {
    const selection = JSON.parse(raw) as SubtitleSelection;
    const info = await getInfoAsync(selection.storedUri);
    if (!info.exists) {
      return null;
    }
    const source = await readAsStringAsync(selection.storedUri);
    const cues = parseSubtitleFile(selection.name, source);
    if (cues.length === 0) {
      return null;
    }
    return { selection, cues };
  } catch {
    return null;
  }
}

export async function saveSubtitleOffset(
  assetId: string,
  offset: number
): Promise<void> {
  const raw = await AsyncStorage.getItem(keyFor(assetId));
  if (!raw) {
    return;
  }
  const selection = JSON.parse(raw) as SubtitleSelection;
  selection.offset = offset;
  await AsyncStorage.setItem(keyFor(assetId), JSON.stringify(selection));
}

export async function importSubtitleFile(
  assetId: string
): Promise<{ selection: SubtitleSelection; cues: SubtitleCue[] } | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: [
      'application/x-subrip',
      'text/plain',
      'text/*',
      '*/*',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]?.uri) {
    return null;
  }
  const asset = picked.assets[0];
  const name = asset.name || 'subtitles.srt';
  const dir = subtitleDir();
  const info = await getInfoAsync(dir);
  if (!info.exists) {
    await makeDirectoryAsync(dir, { intermediates: true });
  }
  const storedUri = `${dir}${assetId.replace(/[^A-Za-z0-9._-]+/g, '_')}-${Date.now()}-${name}`;
  await copyAsync({ from: asset.uri, to: storedUri });
  const source = await readAsStringAsync(storedUri);
  const cues = parseSubtitleFile(name, source);
  if (cues.length === 0) {
    throw new Error(
      'No subtitle cues were found. Playsz can import SRT and basic ASS/SSA dialogue lines.'
    );
  }
  const selection: SubtitleSelection = { name, storedUri, offset: 0 };
  await AsyncStorage.setItem(keyFor(assetId), JSON.stringify(selection));
  return { selection, cues };
}
