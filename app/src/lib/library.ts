import {
  Album,
  AssetField,
  MediaType,
  Query,
  type AssetMetadata,
} from 'expo-media-library';

export type LibraryItem = {
  id: string;
  title: string;
  duration: number | null;
  width: number | null;
  height: number | null;
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
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
  };
}

export async function loadVideoPage(options: {
  offset: number;
  albumId?: string | null;
}): Promise<LibraryItem[]> {
  let query = new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.VIDEO)
    .orderBy({ key: AssetField.MODIFICATION_TIME, ascending: false })
    .offset(options.offset)
    .limit(PAGE_SIZE);
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
