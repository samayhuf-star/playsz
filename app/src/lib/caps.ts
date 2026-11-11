import AsyncStorage from '@react-native-async-storage/async-storage';

import { FREE_EXPORTS_PER_DAY } from '@/constants/products';

const EXPORT_KEY = 'playsz:caps:exports';

type ExportLog = { day: string; count: number };

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function readExportLog(): Promise<ExportLog> {
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
  return log;
}

export async function getExportUsage(): Promise<{ used: number; cap: number }> {
  const log = await readExportLog();
  return { used: log.count, cap: FREE_EXPORTS_PER_DAY };
}

/** Check the free daily cap without incrementing it. */
export async function canExport(isPro: boolean): Promise<{
  allowed: boolean;
  used: number;
  cap: number;
}> {
  const usage = await getExportUsage();
  if (isPro) {
    return { allowed: true, used: usage.used, cap: usage.cap };
  }
  return {
    allowed: usage.used < FREE_EXPORTS_PER_DAY,
    used: usage.used,
    cap: usage.cap,
  };
}

/** Record a successful export only. Failed or cancelled exports must not call this. */
export async function recordSuccessfulExport(): Promise<{
  used: number;
  cap: number;
}> {
  const usage = await getExportUsage();
  const next: ExportLog = { day: todayKey(), count: usage.used + 1 };
  await AsyncStorage.setItem(EXPORT_KEY, JSON.stringify(next));
  return { used: next.count, cap: FREE_EXPORTS_PER_DAY };
}
