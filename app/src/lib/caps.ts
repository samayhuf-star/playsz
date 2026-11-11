import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  FREE_EXPORTS_PER_DAY,
  FREE_PRIVATE_FOLDER_ITEMS,
} from '@/constants/products';

const EXPORT_KEY = 'playsz:caps:exports';
const FOLDER_KEY = 'playsz:caps:private-folder-count';

type ExportLog = { day: string; count: number };

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getExportUsage(): Promise<{ used: number; cap: number }> {
  const raw = await AsyncStorage.getItem(EXPORT_KEY);
  let log: ExportLog = { day: todayKey(), count: 0 };
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ExportLog;
      if (parsed.day === todayKey()) {
        log = parsed;
      }
    } catch {
      // start a fresh day count
    }
  }
  return { used: log.count, cap: FREE_EXPORTS_PER_DAY };
}

export async function tryConsumeExport(isPro: boolean): Promise<{
  allowed: boolean;
  used: number;
  cap: number;
}> {
  if (isPro) {
    const usage = await getExportUsage();
    return { allowed: true, used: usage.used, cap: usage.cap };
  }
  const usage = await getExportUsage();
  if (usage.used >= FREE_EXPORTS_PER_DAY) {
    return { allowed: false, used: usage.used, cap: usage.cap };
  }
  const next: ExportLog = { day: todayKey(), count: usage.used + 1 };
  await AsyncStorage.setItem(EXPORT_KEY, JSON.stringify(next));
  return { allowed: true, used: next.count, cap: FREE_EXPORTS_PER_DAY };
}

export async function getPrivateFolderCount(): Promise<{
  count: number;
  cap: number;
}> {
  const raw = await AsyncStorage.getItem(FOLDER_KEY);
  const count = raw ? Number(raw) || 0 : 0;
  return { count, cap: FREE_PRIVATE_FOLDER_ITEMS };
}

export async function tryAddPrivateItem(isPro: boolean): Promise<{
  allowed: boolean;
  count: number;
  cap: number;
}> {
  const current = await getPrivateFolderCount();
  if (!isPro && current.count >= FREE_PRIVATE_FOLDER_ITEMS) {
    return { allowed: false, count: current.count, cap: current.cap };
  }
  const count = current.count + 1;
  await AsyncStorage.setItem(FOLDER_KEY, String(count));
  return { allowed: true, count, cap: current.cap };
}
