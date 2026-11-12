import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Album,
  AssetField,
  MediaType,
  Query,
  type AssetMetadata,
} from 'expo-media-library';

import {
  mediaLibraryDurationToSeconds,
  type SortField,
  type SortOrder,
} from '@/lib/format';

export type { SortField, SortOrder } from '@/lib/format';

export type LibraryItem = {
  id: string;
  title: string;
  /** Seconds (converted from the media library's milliseconds). */
  duration: number | null;
  width: number | null;
  height: number | null;
  /** Milliseconds since epoch, also the thumbnail cache version. */
  modificationTime: number | null;
  creationTime: number | null;
  /** Bytes, filled in lazily for size sorting. */
  size?: number | null;
};

export type FolderSummary = {
  id: string;
  title: string;
};

export const PAGE_SIZE = 200;

function mapAsset(asset: AssetMetadata): LibraryItem {
  return {
    id: asset.id,
    title: asset.filename?.trim() || 'Untitled video',
    // Root cause of "30:49:10" for a 1:50 clip: this value is milliseconds on iOS and Android.
    duration: mediaLibraryDurationToSeconds(asset.duration),
    width: asset.width,
    height: asset.height,
    modificationTime: asset.modificationTime,
    creationTime: asset.creationTime,
  };
}

/** Sorts the media store can do natively (and therefore page). Name/size are sorted in JS. */
export function isNativeSort(order: SortOrder): boolean {
  return order.field === 'date' || order.field === 'duration';
}

export async function loadVideoPage(options: {
  offset: number;
  albumId?: string | null;
  order?: SortOrder;
  /** Load every video (no paging); used for name and size sorts. */
  all?: boolean;
}): Promise<LibraryItem[]> {
  const order = options.order ?? DEFAULT_SORT;
  const key =
    order.field === 'duration' ? AssetField.DURATION : AssetField.MODIFICATION_TIME;
  const ascending = isNativeSort(order) ? order.ascending : false;
  let query = new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.VIDEO)
    .orderBy({ key, ascending });
  if (!options.all) {
    query = query.offset(options.offset).limit(PAGE_SIZE);
  }
  if (options.albumId) {
    query = query.album(new Album(options.albumId));
  }
  const assets = await query.exeForMetadata();
  return assets.map(mapAsset);
}

export async function loadFolders(): Promise<FolderSummary[]> {
  const albums = await Album.getAlbumsMetadata();
  return albums
    .map((album) => ({ id: album.id, title: album.title || 'Untitled folder' }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

// ---- Saved sort choice ----

const SORT_KEY = 'playsz:library:sort';
export const DEFAULT_SORT: SortOrder = { field: 'date', ascending: false };
export const SORT_LABELS: Record<SortField, string> = {
  name: 'Name',
  date: 'Date',
  size: 'Size',
  duration: 'Duration',
};

export async function loadSortOrder(): Promise<SortOrder> {
  try {
    const raw = await AsyncStorage.getItem(SORT_KEY);
    if (!raw) return DEFAULT_SORT;
    const parsed = JSON.parse(raw) as SortOrder;
    if (parsed && parsed.field in SORT_LABELS && typeof parsed.ascending === 'boolean') {
      return parsed;
    }
  } catch {
    // fall through
  }
  return DEFAULT_SORT;
}

export async function saveSortOrder(order: SortOrder): Promise<void> {
  await AsyncStorage.setItem(SORT_KEY, JSON.stringify(order));
}

// ---- "Library changed" flag so the library screen refreshes when it regains focus ----

let libraryChanged = false;

export function markLibraryChanged(): void {
  libraryChanged = true;
}

export function consumeLibraryChanged(): boolean {
  const changed = libraryChanged;
  libraryChanged = false;
  return changed;
}
