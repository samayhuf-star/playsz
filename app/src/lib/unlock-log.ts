import { documentDirectory, getInfoAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';

/**
 * On-device log of failed vault unlock attempts. Only a timestamp is stored.
 * Nothing is photographed, located or sent anywhere.
 */
export type UnlockAttempt = { at: number };

const FILE = `${documentDirectory ?? ''}unlock-attempts.json`;
const MAX = 50;

export async function listFailedUnlocks(): Promise<UnlockAttempt[]> {
  try {
    const info = await getInfoAsync(FILE);
    if (!info.exists) return [];
    const parsed = JSON.parse(await readAsStringAsync(FILE));
    return Array.isArray(parsed) ? (parsed as UnlockAttempt[]) : [];
  } catch {
    return [];
  }
}

export async function recordFailedUnlock(): Promise<void> {
  try {
    const next = [{ at: Date.now() }, ...(await listFailedUnlocks())].slice(0, MAX);
    await writeAsStringAsync(FILE, JSON.stringify(next));
  } catch {
    // best effort
  }
}

export async function clearFailedUnlocks(): Promise<void> {
  try {
    await writeAsStringAsync(FILE, '[]');
  } catch {
    // best effort
  }
}
