import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '@/constants/colors';
import { VideoThumb } from '@/components/video-thumb';
import { formatBytes } from '@/lib/format';
import { unlockPrivateFolder, usePrivateUnlocked } from '@/lib/private-lock';
import { getResumeFractions } from '@/lib/resume-position';
import {
  listPrivateItems,
  privateCacheId,
  privateItemUri,
  removePrivateItem,
  restorePrivateItemToLibrary,
  type PrivateItem,
} from '@/lib/private-folder';
import { clearFailedUnlocks, listFailedUnlocks, type UnlockAttempt } from '@/lib/unlock-log';
import { useColorSchemeName, useThemedStyles } from '@/theme';

function formatSize(size?: number): string {
  return formatBytes(size) ?? 'File';
}

export default function PrivateFolderScreen() {
  const router = useRouter();
  const scheme = useColorSchemeName();
  const styles = useThemedStyles(createStyles);
  const [items, setItems] = useState<PrivateItem[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [resume, setResume] = useState<Record<string, number>>({});
  const [authBusy, setAuthBusy] = useState(false);
  const [authNote, setAuthNote] = useState<string | null>(null);
  const unlocked = usePrivateUnlocked();
  const [attempts, setAttempts] = useState<UnlockAttempt[]>([]);

  const reload = useCallback(async () => {
    const next = await listPrivateItems();
    setItems(next);
    setAttempts(await listFailedUnlocks());
    setResume(await getResumeFractions(next.map((item) => privateCacheId(item))));
  }, []);

  const authenticate = useCallback(async () => {
    setAuthBusy(true);
    try {
      const result = await unlockPrivateFolder();
      setAuthNote(result.ok ? null : result.message);
    } catch (err) {
      setAuthNote(err instanceof Error ? err.message : 'Could not unlock.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  // Ask for Face ID / passcode as soon as the locked screen opens.
  useEffect(() => {
    if (!unlocked) {
      setItems([]);
      void authenticate();
    }
  }, [authenticate, unlocked]);

  useFocusEffect(
    useCallback(() => {
      if (unlocked) {
        void reload();
      }
    }, [reload, unlocked])
  );

  const isPhoto = (item: PrivateItem) => /\.(jpe?g|png|heic)$/i.test(item.filename);

  const openItem = (item: PrivateItem) => {
    if (isPhoto(item)) return;
    // Plays from the sandbox copy: <documentDirectory>/private-folder/<storedName>.
    router.push({
      pathname: '/player',
      params: { id: privateCacheId(item), title: item.filename },
    });
  };

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>Back</Text>
          </Pressable>
          <Text style={styles.topTitle}>Private folder</Text>
          <View style={styles.backSpacer} />
        </View>
        <View style={styles.lockedBox}>
          <Text style={styles.messageTitle}>Private folder is locked</Text>
          <Text style={styles.messageBody}>
            Unlock with Face ID, Touch ID, fingerprint or your device passcode. It locks
            again whenever Dimmer goes to the background.
          </Text>
          {authNote ? <Text style={styles.note}>{authNote}</Text> : null}
          <Pressable
            style={styles.unlockBtn}
            disabled={authBusy}
            onPress={() => void authenticate()}
          >
            <Text style={styles.unlockLabel}>{authBusy ? 'Checking' : 'Unlock'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const onRestore = async (item: PrivateItem) => {
    try {
      await restorePrivateItemToLibrary(item);
      setNote(`Restored ${item.filename} to the media library. It is still in the private folder.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not restore that file.');
    }
  };

  const onRemove = (item: PrivateItem) => {
    Alert.alert(
      'Remove from private folder?',
      `${item.filename} will be deleted from app-private storage. Restore it to the library first if you still want a copy there.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await removePrivateItem(item.id);
              setItems(await listPrivateItems());
              setNote(`Removed. The folder now has ${result.count} item(s).`);
            })();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Private folder</Text>
        <Pressable onPress={() => router.push('/camera')} hitSlop={12} testID="open-camera">
          <Text style={styles.back}>Camera</Text>
        </Pressable>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {attempts.length > 0 ? (
        <View style={styles.breakIn}>
          <Text style={styles.rowTitle}>
            {attempts.length} failed unlock attempt{attempts.length === 1 ? '' : 's'}
          </Text>
          <Text style={styles.rowMeta}>
            Latest: {new Date(attempts[0].at).toLocaleString()}. Times only, stored on this device.
          </Text>
          <Pressable
            onPress={() => void clearFailedUnlocks().then(() => setAttempts([]))}
            style={styles.smallBtn}
          >
            <Text style={styles.smallLabel}>Clear log</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          <View style={styles.message}>
            <Text style={styles.messageTitle}>No private items yet</Text>
            <Text style={styles.messageBody}>
              Tap Camera to capture photos and videos straight into this vault, or move
              videos in from Settings. Nothing captured here touches your Photos library.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable onPress={() => openItem(item)}>
              {isPhoto(item) ? (
                <Image source={{ uri: privateItemUri(item) }} style={styles.photoThumb} contentFit="cover" />
              ) : (
                <VideoThumb
                  request={{
                    cacheId: privateCacheId(item),
                    version: item.addedAt,
                    fileUri: privateItemUri(item),
                  }}
                  progress={resume[privateCacheId(item)] ?? 0}
                />
              )}
            </Pressable>
            <Pressable style={styles.rowBody} onPress={() => openItem(item)}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.filename}
              </Text>
              <Text style={styles.rowMeta}>{formatSize(item.size)}</Text>
            </Pressable>
            <Pressable style={styles.smallBtn} onPress={() => void onRestore(item)}>
              <Text style={styles.smallLabel}>Restore</Text>
            </Pressable>
            <Pressable style={styles.smallBtn} onPress={() => onRemove(item)}>
              <Text style={styles.smallLabel}>Remove</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    photoThumb: { width: 96, height: 64, borderRadius: 8 },
    breakIn: { margin: 16, padding: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.danger, gap: 6 },
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
    note: { color: c.text, paddingHorizontal: 20, paddingBottom: 8, fontSize: 13, lineHeight: 18 },
    list: { padding: 16, gap: 8, paddingBottom: 32 },
    emptyList: { flexGrow: 1, padding: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
    },
    rowBody: { flex: 1, gap: 4 },
    rowTitle: { color: c.text, fontWeight: '600', fontSize: 15 },
    rowMeta: { color: c.textMuted, fontSize: 12 },
    smallBtn: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    smallLabel: { color: c.text, fontWeight: '700', fontSize: 12 },
    message: {
      padding: 20,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      gap: 8,
    },
    messageTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
    lockedBox: {
      margin: 16,
      padding: 20,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      gap: 10,
    },
    unlockBtn: {
      alignSelf: 'flex-start',
      backgroundColor: c.accent,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    unlockLabel: { color: c.accentDim, fontWeight: '800' },
    messageBody: { color: c.textMuted, fontSize: 14, lineHeight: 21 },
  });
