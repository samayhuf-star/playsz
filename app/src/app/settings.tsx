import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { LEGAL_URLS, hasLegalUrl } from '@/constants/legal';
import * as Linking from 'expo-linking';
import {
  FREE_EXPORTS_PER_DAY,
  FREE_PRIVATE_FOLDER_ITEMS,
} from '@/constants/products';
import {
  getExportUsage,
  getPrivateFolderCount,
  tryAddPrivateItem,
  tryConsumeExport,
} from '@/lib/caps';
import { useIapContext } from '@/providers/iap-provider';

export default function SettingsScreen() {
  const router = useRouter();
  const { isPro } = useIapContext();
  const [exports, setExports] = useState({ used: 0, cap: FREE_EXPORTS_PER_DAY });
  const [folder, setFolder] = useState({
    count: 0,
    cap: FREE_PRIVATE_FOLDER_ITEMS,
  });
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setExports(await getExportUsage());
    setFolder(await getPrivateFolderCount());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const goPaywall = () => router.push('/paywall');

  const onExport = async () => {
    const result = await tryConsumeExport(isPro);
    setExports({ used: result.used, cap: result.cap });
    if (!result.allowed) {
      setNote(
        `Free exports are capped at ${result.cap} per day. Unlock Pro for unlimited exports.`
      );
      goPaywall();
      return;
    }
    setNote(
      isPro
        ? 'Export started (Pro, unlimited). The encoder itself ships in a later build.'
        : `Export counted (${result.used} of ${result.cap} today). The encoder itself ships in a later build.`
    );
  };

  const onAddPrivate = async () => {
    const result = await tryAddPrivateItem(isPro);
    setFolder({ count: result.count, cap: result.cap });
    if (!result.allowed) {
      setNote(
        `The free private folder is capped at ${result.cap} items. Unlock Pro for an unlimited folder.`
      );
      goPaywall();
      return;
    }
    setNote(`Private folder now has ${result.count} item(s).`);
  };

  const onEncryptedExport = () => {
    if (!isPro) {
      setNote('Local encrypted export is a Pro extra.');
      goPaywall();
      return;
    }
    setNote('Encrypted export will write a local archive in a later build.');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
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
              : 'The player is free. Pro lifts caps on exports and the private folder, and unlocks a local encrypted export.'}
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
            Video-to-MP3 export: {isPro ? 'unlimited' : `${exports.used} of ${exports.cap} today`}.
          </Text>
          <Pressable style={styles.secondary} onPress={() => void onExport()}>
            <Text style={styles.secondaryLabel}>Export a video to audio</Text>
          </Pressable>
          <Text style={styles.cardBody}>
            Private folder: {isPro ? 'unlimited' : `${folder.count} of ${folder.cap} items`}.
          </Text>
          <Pressable style={styles.secondary} onPress={() => void onAddPrivate()}>
            <Text style={styles.secondaryLabel}>Add to private folder</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onEncryptedExport}>
            <Text style={styles.secondaryLabel}>Local encrypted export</Text>
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
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.cardBody}>Playsz - All In One Player</Text>
          <Text style={styles.cardBody}>© 2026 Samay Vashsht</Text>
        </View>

        {note ? <Text style={styles.note}>{note}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  back: { color: Colors.accent, fontWeight: '700', width: 64 },
  backSpacer: { width: 64 },
  topTitle: {
    flex: 1,
    color: Colors.text,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  cardBody: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ctaLabel: { color: Colors.accentDim, fontWeight: '800' },
  secondary: {
    alignSelf: 'flex-start',
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryLabel: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  note: { color: Colors.text, fontSize: 14, lineHeight: 20 },
});
