import AsyncStorage from '@react-native-async-storage/async-storage';

import { formatDuration } from '@/lib/format';

const PREFIX = 'playsz:resume:';
const DURATION_PREFIX = 'playsz:duration:';

/** Skip resume if we are this close to the start (seconds). */
const START_THRESHOLD_SEC = 5;
/** Skip resume if we are this close to the end (seconds). */
const END_THRESHOLD_SEC = 10;

function keyFor(assetId: string): string {
  return `${PREFIX}${assetId}`;
}

export async function getResumePosition(
  assetId: string,
  durationSec?: number | null
): Promise<number | null> {
  const raw = await AsyncStorage.getItem(keyFor(assetId));
  if (raw == null) {
    return null;
  }
  const position = Number(raw);
  if (!Number.isFinite(position) || position < START_THRESHOLD_SEC) {
    return null;
  }
  if (
    durationSec != null &&
    durationSec > 0 &&
    position >= durationSec - END_THRESHOLD_SEC
  ) {
    return null;
  }
  return position;
}

export async function saveResumePosition(
  assetId: string,
  positionSec: number,
  durationSec?: number | null
): Promise<void> {
  if (!Number.isFinite(positionSec) || positionSec < START_THRESHOLD_SEC) {
    await AsyncStorage.removeItem(keyFor(assetId));
    return;
  }
  if (
    durationSec != null &&
    durationSec > 0 &&
    positionSec >= durationSec - END_THRESHOLD_SEC
  ) {
    await AsyncStorage.removeItem(keyFor(assetId));
    return;
  }
  await AsyncStorage.setItem(keyFor(assetId), String(Math.floor(positionSec)));
  if (durationSec != null && durationSec > 0) {
    // Remembered so rows without media-library metadata (private folder) can draw a resume bar.
    await AsyncStorage.setItem(`${DURATION_PREFIX}${assetId}`, String(Math.round(durationSec)));
  }
}

export async function clearResumePosition(assetId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(assetId));
}

/** @deprecated Use formatDuration from '@/lib/format'. Kept as an alias (seconds in). */
export function formatTimecode(seconds: number): string {
  return formatDuration(seconds);
}

/** Resume fraction (0..1) for ids whose duration was recorded during playback. */
export async function getResumeFractions(ids: string[]): Promise<Record<string, number>> {
  const positions = await getResumePositions(ids);
  const withPos = Object.keys(positions);
  if (withPos.length === 0) {
    return {};
  }
  const pairs = await AsyncStorage.multiGet(withPos.map((id) => `${DURATION_PREFIX}${id}`));
  const out: Record<string, number> = {};
  for (const [key, value] of pairs) {
    const id = key.slice(DURATION_PREFIX.length);
    const dur = Number(value);
    if (value != null && dur > 0) {
      out[id] = Math.min(1, positions[id] / dur);
    }
  }
  return out;
}

/** Saved resume positions (seconds) for many ids at once, for library progress bars. */
export async function getResumePositions(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) {
    return {};
  }
  const pairs = await AsyncStorage.multiGet(ids.map(keyFor));
  const out: Record<string, number> = {};
  for (const [key, value] of pairs) {
    const n = Number(value);
    if (value != null && Number.isFinite(n) && n > 0) {
      out[key.slice(PREFIX.length)] = n;
    }
  }
  return out;
}


const RECENTS_KEY = 'playsz:recents';
const MAX_RECENTS = 50;

export type RecentItem = {
  id: string;
  title: string;
  playedAt: number;
};

export async function recordRecentPlayback(item: {
  id: string;
  title: string;
}): Promise<void> {
  if (!item.id) {
    return;
  }
  const existing = await listRecentPlayback();
  const next: RecentItem[] = [
    { id: item.id, title: item.title || 'Video', playedAt: Date.now() },
    ...existing.filter((entry) => entry.id !== item.id),
  ].slice(0, MAX_RECENTS);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

export async function listRecentPlayback(): Promise<RecentItem[]> {
  const raw = await AsyncStorage.getItem(RECENTS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
