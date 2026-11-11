import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Asset,
  AssetField,
  MediaType,
  Query,
  requestPermissionsAsync,
  type AssetMetadata,
} from 'expo-media-library';

import { Colors } from '@/constants/colors';
import { formatTimecode } from '@/lib/resume-position';

/** Public-domain sample used on web / when the library is empty, so the player can be exercised. */
export const SAMPLE_VIDEO = {
  id: 'sample',
  uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  title: 'Big Buck Bunny (sample)',
  duration: 596,
} as const;

type LibraryItem = {
  id: string;
  title: string;
  duration: number | null;
  width: number | null;
  height: number | null;
};

type PermissionState = 'loading' | 'denied' | 'granted' | 'unsupported';

async function loadVideos(): Promise<LibraryItem[]> {
  const assets = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.VIDEO)
    .orderBy({ key: AssetField.MODIFICATION_TIME, ascending: false })
    .limit(200)
    .exeForMetadata();

  return assets.map((asset: AssetMetadata) => ({
    id: asset.id,
    title: asset.filename?.trim() || 'Untitled video',
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
  }));
}

export default function HomeScreen() {
  const router = useRouter();
  const [permission, setPermission] = useState<PermissionState>(
    Platform.OS === 'web' ? 'unsupported' : 'loading'
  );
  const [videos, setVideos] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(Platform.OS !== 'web');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLibrary = useCallback(async (isPull = false) => {
    if (Platform.OS === 'web') {
      setPermission('unsupported');
      setLoading(false);
      return;
    }
    try {
      if (isPull) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const { granted, accessPrivileges } = await requestPermissionsAsync(false, [
        'video',
      ]);
      if (!granted && accessPrivileges !== 'limited') {
        setPermission('denied');
        setVideos([]);
        return;
      }
      setPermission('granted');
      setVideos(await loadVideos());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load videos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  const openVideo = useCallback(
    async (item: LibraryItem) => {
      let uri = '';
      let title = item.title;
      if (item.id === SAMPLE_VIDEO.id) {
        uri = SAMPLE_VIDEO.uri;
        title = SAMPLE_VIDEO.title;
      } else {
        const info = await new Asset(item.id).getInfo();
        uri = info.uri;
        title = info.filename || item.title;
      }
      router.push({
        pathname: '/player',
        params: { id: item.id, uri, title },
      });
    },
    [router]
  );

  const openSample = useCallback(() => {
    router.push({
      pathname: '/player',
      params: {
        id: SAMPLE_VIDEO.id,
        uri: SAMPLE_VIDEO.uri,
        title: SAMPLE_VIDEO.title,
      },
    });
  }, [router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.kicker}>Working title</Text>
        <Text style={styles.title}>OpenPlay</Text>
        <Text style={styles.subtitle}>
          No ads. Your files stay standard and yours.
        </Text>
      </View>

      {permission === 'denied' ? (
        <View style={styles.message}>
          <Text style={styles.messageTitle}>Allow access to your videos</Text>
          <Text style={styles.messageBody}>
            OpenPlay only asks for video access so it can play files already on
            this device. No location, no camera, no contacts.
          </Text>
          <Pressable style={styles.cta} onPress={() => void refreshLibrary()}>
            <Text style={styles.ctaLabel}>Grant video access</Text>
          </Pressable>
        </View>
      ) : null}

      {permission === 'unsupported' ? (
        <View style={styles.message}>
          <Text style={styles.messageTitle}>Library scan needs a phone</Text>
          <Text style={styles.messageBody}>
            Video library access is available on Android and iOS. Play the
            sample video to try the player on web.
          </Text>
          <Pressable style={styles.cta} onPress={openSample}>
            <Text style={styles.ctaLabel}>Play sample video</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && permission !== 'unsupported' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.muted}>Scanning videos on this device…</Text>
        </View>
      ) : permission === 'granted' ? (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            videos.length === 0 ? styles.emptyList : styles.list
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refreshLibrary(true)}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.message}>
              <Text style={styles.messageTitle}>No videos on this device</Text>
              <Text style={styles.messageBody}>
                Copy a standard MP4 or MKV onto the phone, then pull to
                refresh. Or play the sample to try the player now.
              </Text>
              <Pressable style={styles.cta} onPress={openSample}>
                <Text style={styles.ctaLabel}>Play sample video</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => void openVideo(item)}
            >
              <View style={styles.thumb}>
                <Text style={styles.thumbLabel}>▶</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.rowMeta}>
                  {[
                    item.duration != null
                      ? formatTimecode(item.duration)
                      : null,
                    item.width && item.height
                      ? `${item.width}×${item.height}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join('  ·  ') || 'Video'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 6,
  },
  kicker: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 360,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 8,
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowPressed: {
    opacity: 0.85,
    backgroundColor: Colors.surfaceElevated,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLabel: {
    color: Colors.accent,
    fontSize: 18,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  muted: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  message: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  messageTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  messageBody: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ctaLabel: {
    color: Colors.accentDim,
    fontWeight: '800',
    fontSize: 14,
  },
  error: {
    color: Colors.danger,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
});
