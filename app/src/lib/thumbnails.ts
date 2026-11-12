import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cacheDirectory,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
  moveAsync,
} from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';

import { createLimiter, isAssetInCloud, resolveAssetUri } from '@/lib/media-source';

/**
 * Disk-cached video thumbnails.
 *
 * - Generated with expo-video-thumbnails from the RESOLVED file/content URI (never ph://).
 * - Cached under <cacheDirectory>/thumbnails/, file name keyed by a hash of the asset id and
 *   its modificationTime, so an edited video gets a fresh thumbnail.
 * - At most 3 generations run at once; rows request them lazily when FlatList mounts them.
 * - iOS iCloud-only assets are skipped (generating would download the whole video).
 */
const DIR = `${cacheDirectory ?? ''}thumbnails/`;
const limit = createLimiter(3);
const memory = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
let dirReady: Promise<void> | null = null;

function hash(input: string): string {
  // djb2, base36. Collisions only cost a wrong thumbnail; the key also carries mtime.
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function ensureDir(): Promise<void> {
  if (!dirReady) {
    dirReady = (async () => {
      const info = await getInfoAsync(DIR);
      if (!info.exists) {
        await makeDirectoryAsync(DIR, { intermediates: true });
      }
    })().catch((err) => {
      dirReady = null;
      throw err;
    });
  }
  return dirReady;
}

export function thumbnailPath(cacheId: string, version: number | null | undefined): string {
  return `${DIR}${hash(cacheId)}_${Math.floor(version ?? 0)}.jpg`;
}

export type ThumbnailRequest = {
  /** Stable id: a media-library asset id, or `private:<id>`. */
  cacheId: string;
  /** modificationTime (library) or addedAt (private); part of the cache key. */
  version: number | null | undefined;
  /** Media-library asset id to resolve, when the video is in the library. */
  assetId?: string;
  /** Already-readable file URI (private folder items). */
  fileUri?: string;
  /** Duration in seconds, used to pick a frame that is not a black first frame. */
  durationSec?: number | null;
};

async function generate(req: ThumbnailRequest): Promise<string | null> {
  if (Platform.OS === 'web' || !cacheDirectory) {
    return null;
  }
  const dest = thumbnailPath(req.cacheId, req.version);
  const existing = await getInfoAsync(dest);
  if (existing.exists) {
    return dest;
  }
  return limit(async () => {
    await ensureDir();
    let source = req.fileUri;
    if (!source && req.assetId) {
      if (await isAssetInCloud(req.assetId)) {
        return null;
      }
      source = await resolveAssetUri(req.assetId);
      void recordFileSize(req.assetId, req.version, source);
    }
    if (!source) {
      return null;
    }
    const dur = req.durationSec ?? 0;
    const timeMs = dur > 4 ? Math.min(3000, Math.floor((dur * 1000) / 3)) : 0;
    const result = await VideoThumbnails.getThumbnailAsync(source, {
      time: timeMs,
      quality: 0.6,
    });
    await moveAsync({ from: result.uri, to: dest });
    return dest;
  });
}

export function getThumbnail(req: ThumbnailRequest): Promise<string | null> {
  const key = thumbnailPath(req.cacheId, req.version);
  if (memory.has(key)) {
    return Promise.resolve(memory.get(key) ?? null);
  }
  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }
  const task = generate(req)
    .catch(() => null)
    .then((uri) => {
      memory.set(key, uri);
      inflight.delete(key);
      return uri;
    });
  inflight.set(key, task);
  return task;
}

/** React hook: lazily loads (or generates) a thumbnail for a mounted row. */
export function useThumbnail(req: ThumbnailRequest | null): string | null {
  const key = req ? thumbnailPath(req.cacheId, req.version) : null;
  const [uri, setUri] = useState<string | null>(() => (key ? memory.get(key) ?? null : null));
  useEffect(() => {
    if (!req || !key) {
      setUri(null);
      return;
    }
    let alive = true;
    const cached = memory.get(key);
    if (cached !== undefined) {
      setUri(cached);
      return;
    }
    void getThumbnail(req).then((next) => {
      if (alive) {
        setUri(next);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return uri;
}

export async function deleteThumbnail(cacheId: string, version: number | null | undefined) {
  const path = thumbnailPath(cacheId, version);
  memory.delete(path);
  await deleteAsync(path, { idempotent: true });
}

// ---- File sizes (for "sort by size"). Media-library metadata has no size field. ----

const SIZE_KEY = 'playsz:sizes:v1';
type SizeMap = Record<string, { v: number; s: number }>;
let sizeMap: SizeMap | null = null;
let sizeWrite: ReturnType<typeof setTimeout> | null = null;

async function loadSizes(): Promise<SizeMap> {
  if (sizeMap) return sizeMap;
  try {
    const raw = await AsyncStorage.getItem(SIZE_KEY);
    sizeMap = raw ? (JSON.parse(raw) as SizeMap) : {};
  } catch {
    sizeMap = {};
  }
  return sizeMap;
}

function persistSizes() {
  if (sizeWrite) clearTimeout(sizeWrite);
  sizeWrite = setTimeout(() => {
    if (sizeMap) void AsyncStorage.setItem(SIZE_KEY, JSON.stringify(sizeMap));
  }, 800);
}

async function recordFileSize(assetId: string, version: number | null | undefined, uri: string) {
  try {
    const info = await getInfoAsync(uri);
    if (info.exists && typeof info.size === 'number' && info.size > 0) {
      const map = await loadSizes();
      map[assetId] = { v: Math.floor(version ?? 0), s: info.size };
      persistSizes();
      return info.size;
    }
  } catch {
    // Some content:// providers do not report a size; leave it unknown.
  }
  return null;
}

/** Cached sizes for the given items (only entries whose version still matches). */
export async function getKnownSizes(
  items: { id: string; modificationTime: number | null }[]
): Promise<Record<string, number>> {
  const map = await loadSizes();
  const out: Record<string, number> = {};
  for (const item of items) {
    const hit = map[item.id];
    if (hit && hit.v === Math.floor(item.modificationTime ?? 0)) {
      out[item.id] = hit.s;
    }
  }
  return out;
}

/**
 * Measure sizes for items that are not cached yet (limited concurrency, iCloud-only skipped).
 * Calls onProgress with each newly known size so the UI can re-sort.
 */
export async function measureSizes(
  items: { id: string; modificationTime: number | null }[],
  onProgress: (id: string, size: number) => void,
  isCancelled: () => boolean
): Promise<void> {
  const known = await getKnownSizes(items);
  const todo = items.filter((item) => known[item.id] == null);
  await Promise.all(
    todo.map((item) =>
      limit(async () => {
        if (isCancelled()) return;
        try {
          if (await isAssetInCloud(item.id)) return;
          const uri = await resolveAssetUri(item.id);
          const size = await recordFileSize(item.id, item.modificationTime, uri);
          if (size != null && !isCancelled()) onProgress(item.id, size);
        } catch {
          // unknown size sorts last
        }
      })
    )
  );
}
