import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'playsz:resume:';

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
}

export async function clearResumePosition(assetId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(assetId));
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
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
