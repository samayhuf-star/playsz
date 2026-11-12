import { Platform } from 'react-native';
import { Asset } from 'expo-media-library';

/**
 * Resolve a media-library asset id to a URI the player / thumbnailer / file copier can read.
 *
 * SDK 58 note: expo-media-library's `next` API replaced `getAssetInfoAsync(asset).localUri`
 * with `Asset.getUri()`. On iOS it calls PHImageManager.requestAVAsset with
 * `isNetworkAccessAllowed = true` and `.highQualityFormat`, so iCloud-only videos are
 * downloaded first (the equivalent of `shouldDownloadFromNetwork: true`), and edited /
 * slow-mo compositions are exported to a temp .mov. It returns a `file://` URL.
 * On Android it returns the MediaStore `content://` URI, which ExoPlayer and
 * MediaMetadataRetriever read directly.
 *
 * Results are memoised for a short time because each iOS call is a PhotoKit request.
 */
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { uri: string; at: number }>();
const inflight = new Map<string, Promise<string>>();

export function isPhotoKitId(id: string): boolean {
  return id.startsWith('ph://');
}

export async function resolveAssetUri(assetId: string): Promise<string> {
  const hit = cache.get(assetId);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.uri;
  }
  const pending = inflight.get(assetId);
  if (pending) {
    return pending;
  }
  const task = (async () => {
    const asset = new Asset(assetId);
    const uri = await asset.getUri();
    if (!uri) {
      throw new Error('This video has no readable file.');
    }
    cache.set(assetId, { uri, at: Date.now() });
    return uri;
  })();
  inflight.set(assetId, task);
  try {
    return await task;
  } finally {
    inflight.delete(assetId);
  }
}

/** True when the iOS asset is only in iCloud (not downloaded). Never triggers a download. */
export async function isAssetInCloud(assetId: string): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    return await new Asset(assetId).getIsInCloud();
  } catch {
    return false;
  }
}

export function forgetResolvedUri(assetId: string): void {
  cache.delete(assetId);
}

/** Small promise pool so thumbnail / size work never floods PhotoKit or MediaStore. */
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= max) return;
    const run = queue.shift();
    if (run) {
      active += 1;
      run();
    }
  };
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      });
      next();
    });
  };
}
