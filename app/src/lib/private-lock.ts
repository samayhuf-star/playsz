import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Face ID / Touch ID / fingerprint lock for the private folder (expo-local-authentication, MIT).
 *
 * - Unlock uses the device biometrics with the device passcode as a fallback
 *   (disableDeviceFallback: false).
 * - The folder locks again whenever the app goes to the background.
 * - The unlocked state lives in memory only; a cold start is always locked.
 */
let unlocked = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function isPrivateUnlocked(): boolean {
  return unlocked;
}

export function lockPrivateFolder(): void {
  if (unlocked) {
    unlocked = false;
    emit();
  }
}

// 'inactive' (Face ID sheet, Control Centre, app switcher peek) does not lock; 'background' does.
AppState.addEventListener('change', (state) => {
  if (state === 'background') {
    lockPrivateFolder();
  }
});

export function usePrivateUnlocked(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unlocked,
    () => false
  );
}

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'failed' | 'no-security' | 'unsupported'; message: string };

export async function unlockPrivateFolder(): Promise<UnlockResult> {
  if (unlocked) return { ok: true };
  if (Platform.OS === 'web') {
    return { ok: false, reason: 'unsupported', message: 'The private folder needs a phone.' };
  }
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return {
      ok: false,
      reason: 'no-security',
      message:
        'Set a device passcode (and optionally Face ID or a fingerprint) in system settings to lock the private folder.',
    };
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock private folder',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    fallbackLabel: 'Use passcode',
  });
  if (result.success) {
    unlocked = true;
    emit();
    return { ok: true };
  }
  const cancelled =
    result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel';
  return {
    ok: false,
    reason: cancelled ? 'cancelled' : 'failed',
    message: cancelled ? 'Unlock cancelled.' : 'Could not verify it is you. Try again.',
  };
}
