import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

import type { ThemeColors } from '@/constants/colors';
import { LEGAL_URLS, PENDING_HOSTING, hasLegalUrl } from '@/constants/legal';
import {
  FREE_EXPORTS_PER_DAY,
  FREE_PRIVATE_FOLDER_ITEMS,
} from '@/constants/products';
import { PasswordModal } from '@/components/password-modal';
import { VideoPickerModal } from '@/components/video-picker-modal';
import { exportVideoAudio } from '@/lib/audio-export';
import { canExport, getExportUsage, recordSuccessfulExport } from '@/lib/caps';
import {
  addPrivateItem,
  canAddPrivateItem,
  getPrivateFolderCount,
} from '@/lib/private-folder';
import {
  importEncryptedPrivateFolder,
  shareEncryptedPrivateFolder,
} from '@/lib/vault-export';
import { useIapContext } from '@/providers/iap-provider';
import { useColorSchemeName, useThemedStyles } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const scheme = useColorSchemeName();
  const styles = useThemedStyles(createStyles);
  const { isPro } = useIapContext();
  const [exports, setExports] = useState({ used: 0, cap: FREE_EXPORTS_PER_DAY });
  const [folder, setFolder] = useState({
    count: 0,
    cap: FREE_PRIVATE_FOLDER_ITEMS,
  });
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<'export' | 'private' | null>(null);
  const [vaultMode, setVaultMode] = useState<'export' | 'import' | null>(null);

  const reload = useCallback(async () => {
    setExports(await getExportUsage());
    const current = await getPrivateFolderCount();
    setFolder({ count: current.count, cap: current.cap });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const goPaywall = () => router.push('/paywall');

  const onExport = async () => {
    const result = await canExport(isPro);
    setExports({ used: result.used, cap: result.cap });
    if (!result.allowed) {
      setNote(
        `Free exports are capped at ${result.cap} per day. Unlock Pro for unlimited exports.`
      );
      goPaywall();
      return;
    }
    setPicker('export');
  };

  const onAddPrivate = async () => {
    const result = await canAddPrivateItem(isPro);
    setFolder({ count: result.count, cap: result.cap });
    if (!result.allowed) {
      setNote(
        `The free private folder is capped at ${result.cap} items. Unlock Pro for an unlimited folder.`
      );
      goPaywall();
      return;
    }
    setPicker('private');
  };

  const onEncryptedExport = () => {
    if (!isPro) {
      setNote('Local encrypted export is a Pro extra.');
      goPaywall();
      return;
    }
    if (folder.count === 0) {
      setNote('Add at least one item to the private folder before exporting.');
      return;
    }
    setVaultMode('export');
  };

  const onEncryptedImport = () => {
    if (!isPro) {
      setNote('Restoring an encrypted archive is a Pro extra.');
      goPaywall();
      return;
    }
    setVaultMode('import');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Settings</Text>
        <View style={styles.backSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Playsz Pro</Text>
          <Text style={styles.cardBody}>
            {isPro
              ? 'Pro is unlocked on this device. Caps on extras are lifted.'
              : 'The player is free. Pro lifts caps on audio exports and the private folder, and unlocks a local encrypted export.'}
          </Text>
          <Pressable style={styles.cta} onPress={goPaywall}>
            <Text style={styles.ctaLabel}>
              {isPro ? 'View Pro and restore' : 'Unlock Pro'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Capped extras</Text>
          <Text style={styles.cardBody}>
            Video-to-M4A export: {isPro ? 'unlimited' : `${exports.used} of ${exports.cap} today`}.
            AAC audio is remuxed on the device to an .m4a file. Failed exports are not counted.
          </Text>
          <Pressable
            style={styles.secondary}
            disabled={busy}
            onPress={() => void onExport()}
          >
            <Text style={styles.secondaryLabel}>Export a video to audio</Text>
          </Pressable>
          <Text style={styles.cardBody}>
            Private folder: {isPro ? 'unlimited' : `${folder.count} of ${folder.cap} items`}.
            Files are copied into app-private storage. The cap uses the real item count.
          </Text>
          <Pressable
            style={styles.secondary}
            disabled={busy}
            onPress={() => void onAddPrivate()}
          >
            <Text style={styles.secondaryLabel}>Add to private folder</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => router.push('/private-folder')}
          >
            <Text style={styles.secondaryLabel}>Open private folder</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            disabled={busy}
            onPress={onEncryptedExport}
          >
            <Text style={styles.secondaryLabel}>Local encrypted export</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            disabled={busy}
            onPress={onEncryptedImport}
          >
            <Text style={styles.secondaryLabel}>Restore encrypted archive</Text>
          </Pressable>
        </View>

        {hasLegalUrl('terms') || hasLegalUrl('privacy') ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Legal</Text>
            {hasLegalUrl('terms') ? (
              <Pressable style={styles.secondary} onPress={() => void Linking.openURL(LEGAL_URLS.terms)}>
                <Text style={styles.secondaryLabel}>Terms of Use</Text>
              </Pressable>
            ) : null}
            {hasLegalUrl('privacy') ? (
              <Pressable style={styles.secondary} onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}>
                <Text style={styles.secondaryLabel}>Privacy Policy</Text>
              </Pressable>
            ) : null}
            {PENDING_HOSTING ? (
              <Text style={styles.cardBody}>
                These links use the planned GitHub Pages URLs and will 404 until
                the site is hosted.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.cardBody}>Playsz - All In One Player</Text>
          <Text style={styles.cardBody}>© 2026 Samay Vashsht</Text>
        </View>

        {note ? <Text style={styles.note}>{note}</Text> : null}
      </ScrollView>

      <VideoPickerModal
        visible={picker != null}
        title={picker === 'export' ? 'Choose a video to export' : 'Add a video to the private folder'}
        onClose={() => setPicker(null)}
        onPick={(video) => {
          const mode = picker;
          setPicker(null);
          if (!mode) {
            return;
          }
          void (async () => {
            setBusy(true);
            try {
              if (mode === 'export') {
                const allowed = await canExport(isPro);
                if (!allowed.allowed) {
                  setExports({ used: allowed.used, cap: allowed.cap });
                  setNote(
                    `Free exports are capped at ${allowed.cap} per day. Unlock Pro for unlimited exports.`
                  );
                  goPaywall();
                  return;
                }
                const result = await exportVideoAudio({
                  sourceUri: video.uri,
                  title: video.title,
                });
                const usage = await recordSuccessfulExport();
                setExports(usage);
                setNote(
                  result.savedToLibrary
                    ? `Saved ${video.title} as M4A (${usage.used} of ${usage.cap} today).`
                    : `Exported ${video.title} as M4A and opened a share sheet (${usage.used} of ${usage.cap} today).`
                );
              } else {
                const result = await addPrivateItem({
                  sourceUri: video.uri,
                  filename: video.title,
                  sourceAssetId: video.id,
                  isPro,
                });
                setFolder({ count: result.count, cap: result.cap });
                if (!result.allowed) {
                  setNote(
                    `The free private folder is capped at ${result.cap} items. Unlock Pro for an unlimited folder.`
                  );
                  goPaywall();
                  return;
                }
                setNote(`Added ${video.title} to the private folder (${result.count} of ${result.cap}).`);
              }
            } catch (err) {
              setNote(
                err instanceof Error ? err.message : 'The action failed. Nothing was counted against a cap.'
              );
            } finally {
              setBusy(false);
            }
          })();
        }}
      />

      <PasswordModal
        visible={vaultMode != null}
        title={vaultMode === 'import' ? 'Open encrypted archive' : 'Encrypt private folder'}
        body={
          vaultMode === 'import'
            ? 'Enter the password for the archive. The files will be restored into the private folder on this device.'
            : 'Choose a password you will remember. This is the only way to open the archive later. The archive stays on the device unless you share it.'
        }
        confirmLabel={vaultMode === 'import' ? 'Choose archive' : 'Create archive'}
        requireConfirm={vaultMode === 'export'}
        onCancel={() => setVaultMode(null)}
        onSubmit={(password) => {
          const mode = vaultMode;
          setVaultMode(null);
          if (!mode) {
            return;
          }
          void (async () => {
            setBusy(true);
            try {
              if (mode === 'export') {
                await shareEncryptedPrivateFolder(password);
                setNote('Encrypted archive created. Use the share sheet to copy it to your own storage.');
              } else {
                const result = await importEncryptedPrivateFolder({ password, isPro });
                setFolder({ count: result.count, cap: result.cap });
                setNote(`Restored ${result.added} item(s) into the private folder.`);
              }
            } catch (err) {
              if (err instanceof Error && err.message === 'cancelled') {
                setNote(null);
              } else {
                setNote(err instanceof Error ? err.message : 'The archive action failed.');
              }
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    back: { color: c.accent, fontWeight: '700', width: 64 },
    backSpacer: { width: 64 },
    topTitle: {
      flex: 1,
      color: c.text,
      textAlign: 'center',
      fontWeight: '700',
      fontSize: 16,
    },
    content: { padding: 20, gap: 16, paddingBottom: 40 },
    card: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      gap: 10,
    },
    cardTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
    cardBody: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    cta: {
      alignSelf: 'flex-start',
      backgroundColor: c.accent,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    ctaLabel: { color: c.accentDim, fontWeight: '800' },
    secondary: {
      alignSelf: 'flex-start',
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    secondaryLabel: { color: c.text, fontWeight: '700', fontSize: 13 },
    note: { color: c.text, fontSize: 14, lineHeight: 20 },
  });
