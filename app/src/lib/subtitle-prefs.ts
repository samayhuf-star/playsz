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

// ---- Subtitle styling (global, saved) ----

export type SubtitleSize = 'small' | 'medium' | 'large' | 'xlarge';
export type SubtitleColor = 'white' | 'yellow' | 'green' | 'cyan';
export type SubtitleBackground = 'shadow' | 'translucent' | 'solid';

export type SubtitleStyle = {
  size: SubtitleSize;
  color: SubtitleColor;
  background: SubtitleBackground;
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  size: 'medium',
  color: 'white',
  background: 'shadow',
};

export const SUBTITLE_SIZES: Record<SubtitleSize, { label: string; fontSize: number }> = {
  small: { label: 'S', fontSize: 14 },
  medium: { label: 'M', fontSize: 18 },
  large: { label: 'L', fontSize: 23 },
  xlarge: { label: 'XL', fontSize: 29 },
};

export const SUBTITLE_COLORS: Record<SubtitleColor, { label: string; value: string }> = {
  white: { label: 'White', value: '#FFFFFF' },
  yellow: { label: 'Yellow', value: '#FFE45C' },
  green: { label: 'Green', value: '#6EE7A0' },
  cyan: { label: 'Cyan', value: '#7DE3FF' },
};

export const SUBTITLE_BACKGROUNDS: Record<
  SubtitleBackground,
  { label: string; value: string }
> = {
  shadow: { label: 'Shadow', value: 'transparent' },
  translucent: { label: 'Box', value: 'rgba(0,0,0,0.55)' },
  solid: { label: 'Solid', value: '#000000' },
};

const STYLE_KEY = 'playsz:subtitle-style';

export async function loadSubtitleStyle(): Promise<SubtitleStyle> {
  try {
    const raw = await AsyncStorage.getItem(STYLE_KEY);
    if (!raw) return DEFAULT_SUBTITLE_STYLE;
    const parsed = JSON.parse(raw) as Partial<SubtitleStyle>;
    return {
      size: parsed.size && parsed.size in SUBTITLE_SIZES ? parsed.size : DEFAULT_SUBTITLE_STYLE.size,
      color:
        parsed.color && parsed.color in SUBTITLE_COLORS ? parsed.color : DEFAULT_SUBTITLE_STYLE.color,
      background:
        parsed.background && parsed.background in SUBTITLE_BACKGROUNDS
          ? parsed.background
          : DEFAULT_SUBTITLE_STYLE.background,
    };
  } catch {
    return DEFAULT_SUBTITLE_STYLE;
  }
}

export async function saveSubtitleStyle(style: SubtitleStyle): Promise<void> {
  await AsyncStorage.setItem(STYLE_KEY, JSON.stringify(style));
}

// ---- Player preferences (saved) ----

const PLAYER_KEY = 'playsz:player-prefs';
export type PlayerPrefs = { rate: number; loop: boolean };
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export async function loadPlayerPrefs(): Promise<PlayerPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PLAYER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PlayerPrefs>) : {};
    const rate =
      typeof parsed.rate === 'number' && (PLAYBACK_RATES as readonly number[]).includes(parsed.rate)
        ? parsed.rate
        : 1;
    return { rate, loop: parsed.loop === true };
  } catch {
    return { rate: 1, loop: false };
  }
}

export async function savePlayerPrefs(prefs: PlayerPrefs): Promise<void> {
  await AsyncStorage.setItem(PLAYER_KEY, JSON.stringify(prefs));
}
