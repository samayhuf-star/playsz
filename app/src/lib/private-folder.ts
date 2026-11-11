import { Asset } from 'expo-media-library';
import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

import { FREE_PRIVATE_FOLDER_ITEMS } from '@/constants/products';

export type PrivateItem = {
  id: string;
  filename: string;
  storedName: string;
  sourceAssetId?: string;
  addedAt: number;
  size?: number;
};

const FOLDER = `${documentDirectory ?? ''}private-folder/`;
const MANIFEST = `${FOLDER}manifest.json`;

async function ensureFolder(): Promise<void> {
  if (!documentDirectory) {
    throw new Error('App-private storage is not available on this platform.');
  }
  const info = await getInfoAsync(FOLDER);
  if (!info.exists) {
    await makeDirectoryAsync(FOLDER, { intermediates: true });
  }
}

async function readManifest(): Promise<PrivateItem[]> {
  await ensureFolder();
  const info = await getInfoAsync(MANIFEST);
  if (!info.exists) {
    return [];
  }
  try {
    const raw = await readAsStringAsync(MANIFEST);
    const parsed = JSON.parse(raw) as PrivateItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeManifest(items: PrivateItem[]): Promise<void> {
  await ensureFolder();
  await writeAsStringAsync(MANIFEST, JSON.stringify(items));
}

function safeFileName(name: string): string {
  const base = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '') || 'video';
  return base.slice(0, 80);
}

async function reconcile(items: PrivateItem[]): Promise<PrivateItem[]> {
  const kept: PrivateItem[] = [];
  let changed = false;
  for (const item of items) {
    const info = await getInfoAsync(`${FOLDER}${item.storedName}`);
    if (info.exists) {
      kept.push({
        ...item,
        size: typeof info.size === 'number' ? info.size : item.size,
      });
    } else {
      changed = true;
    }
  }
  if (changed) {
    await writeManifest(kept);
  }
  return kept;
}

export function privateFolderDir(): string {
  return FOLDER;
}

export async function listPrivateItems(): Promise<PrivateItem[]> {
  return reconcile(await readManifest());
}

export async function getPrivateFolderCount(): Promise<{
  count: number;
  cap: number;
  items: PrivateItem[];
}> {
  const items = await listPrivateItems();
  return { count: items.length, cap: FREE_PRIVATE_FOLDER_ITEMS, items };
}

export async function canAddPrivateItem(isPro: boolean): Promise<{
  allowed: boolean;
  count: number;
  cap: number;
}> {
  const current = await getPrivateFolderCount();
  if (!isPro && current.count >= FREE_PRIVATE_FOLDER_ITEMS) {
    return { allowed: false, count: current.count, cap: current.cap };
  }
  return { allowed: true, count: current.count, cap: current.cap };
}

export async function addPrivateItem(params: {
  sourceUri: string;
  filename: string;
  sourceAssetId?: string;
  isPro: boolean;
}): Promise<{ allowed: boolean; count: number; cap: number; item?: PrivateItem }> {
  const gate = await canAddPrivateItem(params.isPro);
  if (!gate.allowed) {
    return gate;
  }

  await ensureFolder();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const storedName = `${id}_${safeFileName(params.filename)}`;
  const dest = `${FOLDER}${storedName}`;
  await copyAsync({ from: params.sourceUri, to: dest });
  const info = await getInfoAsync(dest);
  if (!info.exists) {
    throw new Error('The file could not be copied into the private folder.');
  }

  const item: PrivateItem = {
    id,
    filename: params.filename,
    storedName,
    sourceAssetId: params.sourceAssetId,
    addedAt: Date.now(),
    size: typeof info.size === 'number' ? info.size : undefined,
  };
  const items = await listPrivateItems();
  items.push(item);
  await writeManifest(items);
  return {
    allowed: true,
    count: items.length,
    cap: FREE_PRIVATE_FOLDER_ITEMS,
    item,
  };
}

export async function removePrivateItem(id: string): Promise<{
  count: number;
  cap: number;
}> {
  const items = await listPrivateItems();
  const match = items.find((item) => item.id === id);
  if (match) {
    await deleteAsync(`${FOLDER}${match.storedName}`, { idempotent: true });
  }
  const next = items.filter((item) => item.id !== id);
  await writeManifest(next);
  return { count: next.length, cap: FREE_PRIVATE_FOLDER_ITEMS };
}

export function privateItemUri(item: PrivateItem): string {
  return `${FOLDER}${item.storedName}`;
}

/** Copy the private file back into the device media library. The private copy stays. */
export async function restorePrivateItemToLibrary(item: PrivateItem): Promise<void> {
  const uri = privateItemUri(item);
  const info = await getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('That private-folder item is no longer on the device.');
  }
  await Asset.create(uri);
}

export async function registerImportedPrivateFiles(
  fileNames: string[],
  isPro: boolean
): Promise<{ count: number; cap: number; added: number }> {
  const current = await listPrivateItems();
  const known = new Set(current.map((item) => item.storedName));
  const additions: PrivateItem[] = [];
  for (const storedName of fileNames) {
    if (storedName === 'manifest.json' || known.has(storedName)) {
      continue;
    }
    const info = await getInfoAsync(`${FOLDER}${storedName}`);
    if (!info.exists) {
      continue;
    }
    if (!isPro && current.length + additions.length >= FREE_PRIVATE_FOLDER_ITEMS) {
      await deleteAsync(`${FOLDER}${storedName}`, { idempotent: true });
      continue;
    }
    additions.push({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      filename: storedName.replace(/^[a-z0-9]+-[a-z0-9]+_/i, '') || storedName,
      storedName,
      addedAt: Date.now(),
      size: typeof info.size === 'number' ? info.size : undefined,
    });
  }
  const next = [...current, ...additions];
  await writeManifest(next);
  return {
    count: next.length,
    cap: FREE_PRIVATE_FOLDER_ITEMS,
    added: additions.length,
  };
}
