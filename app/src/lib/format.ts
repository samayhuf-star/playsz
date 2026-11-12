/**
 * Pure formatting helpers. No React Native imports, so scripts/check-format.mjs
 * can run them under plain Node.
 *
 * Units:
 * - expo-media-library (SDK 58 `next` API) returns asset `duration` in
 *   MILLISECONDS on both iOS (PHAsset.duration * 1000) and Android
 *   (MediaStore DURATION), even though the d.ts comment says seconds.
 * - expo-video `player.currentTime` / `player.duration` are SECONDS.
 * - expo-video-thumbnails `time` option is MILLISECONDS.
 */

/** Format a duration in seconds as m:ss, or h:mm:ss for an hour or more. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
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

/** Convert a media-library duration (milliseconds) to seconds, or null. */
export function mediaLibraryDurationToSeconds(
  durationMs: number | null | undefined
): number | null {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }
  return durationMs / 1000;
}

/** Human file size. */
export function formatBytes(size: number | null | undefined): string | null {
  if (size == null || !Number.isFinite(size) || size <= 0) {
    return null;
  }
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Fraction watched (0..1) for a resume bar, or 0 when unknown. */
export function resumeFraction(
  positionSec: number | null | undefined,
  durationSec: number | null | undefined
): number {
  if (
    positionSec == null ||
    durationSec == null ||
    !Number.isFinite(positionSec) ||
    !Number.isFinite(durationSec) ||
    durationSec <= 0 ||
    positionSec <= 0
  ) {
    return 0;
  }
  return Math.min(1, Math.max(0, positionSec / durationSec));
}

export type SortField = 'name' | 'date' | 'size' | 'duration';
export type SortOrder = { field: SortField; ascending: boolean };

export type SortableItem = {
  title: string;
  modificationTime: number | null;
  duration: number | null;
  size?: number | null;
};

/**
 * Client-side sort. Unknown values (null) always go last, whichever the direction.
 * Ties fall back to the title so the order is stable.
 */
export function sortItems<T extends SortableItem>(items: T[], order: SortOrder): T[] {
  const dir = order.ascending ? 1 : -1;
  const byTitle = (a: T, b: T) =>
    a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
  const value = (item: T): number | null => {
    switch (order.field) {
      case 'date':
        return item.modificationTime ?? null;
      case 'duration':
        return item.duration ?? null;
      case 'size':
        return item.size ?? null;
      default:
        return null;
    }
  };
  return [...items].sort((a, b) => {
    if (order.field === 'name') {
      return byTitle(a, b) * dir;
    }
    const va = value(a);
    const vb = value(b);
    if (va == null && vb == null) return byTitle(a, b);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va === vb) return byTitle(a, b);
    return (va - vb) * dir;
  });
}
