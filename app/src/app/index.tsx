import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestPermissionsAsync } from 'expo-media-library';

import type { ThemeColors } from '@/constants/colors';
import { VideoThumb } from '@/components/video-thumb';
import { formatBytes, resumeFraction, sortItems, type SortField, type SortOrder } from '@/lib/format';
import {
  consumeLibraryChanged,
  DEFAULT_SORT,
  isNativeSort,
  loadFolders,
  loadSortOrder,
  loadVideoPage,
  PAGE_SIZE,
  saveSortOrder,
  SORT_LABELS,
  type FolderSummary,
  type LibraryItem,
} from '@/lib/library';
import {
  getResumePositions,
  listRecentPlayback,
  type RecentItem,
} from '@/lib/resume-position';
import { getKnownSizes, measureSizes } from '@/lib/thumbnails';
import { useIapContext } from '@/providers/iap-provider';
import { useColorSchemeName, useColors, useThemedStyles } from '@/theme';

type PermissionState = 'loading' | 'denied' | 'granted' | 'unsupported';
type Tab = 'library' | 'folders' | 'recents';

export default function HomeScreen() {
  const router = useRouter();
  const { isPro } = useIapContext();
  const scheme = useColorSchemeName();
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [permission, setPermission] = useState<PermissionState>(
    Platform.OS === 'web' ? 'unsupported' : 'loading'
  );
  const [tab, setTab] = useState<Tab>('library');
  const [videos, setVideos] = useState<LibraryItem[]>([]);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [albumTitle, setAlbumTitle] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(Platform.OS !== 'web');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOrder | null>(null);
  const [resume, setResume] = useState<Record<string, number>>({});
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [measuring, setMeasuring] = useState(false);
  const sortRef = useRef<SortOrder>(DEFAULT_SORT);
  if (sort) {
    sortRef.current = sort;
  }

  useEffect(() => {
    void loadSortOrder().then(setSort);
  }, []);

  const requestAccess = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      setPermission('unsupported');
      return false;
    }
    const { granted, accessPrivileges } = await requestPermissionsAsync(false, [
      'video',
    ]);
    if (!granted && accessPrivileges !== 'limited') {
      setPermission('denied');
      setVideos([]);
      return false;
    }
    setPermission('granted');
    return true;
  }, []);

  const loadPage = useCallback(
    async (nextOffset: number, replace: boolean, nextAlbumId: string | null) => {
      const order = sortRef.current;
      const all = !isNativeSort(order);
      const page = await loadVideoPage({
        offset: nextOffset,
        albumId: nextAlbumId,
        order,
        all,
      });
      setVideos((current) => (replace ? page : [...current, ...page]));
      setOffset(nextOffset + page.length);
      setHasMore(!all && page.length === PAGE_SIZE);
    },
    []
  );

  const refreshLibrary = useCallback(
    async (isPull = false) => {
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
        if (!(await requestAccess())) {
          return;
        }
        await Promise.all([
          loadPage(0, true, albumId),
          loadFolders().then(setFolders).catch(() => setFolders([])),
          listRecentPlayback()
            // Private-folder titles never show in the library's Recents.
            .then((list) => setRecents(list.filter((r) => !r.id.startsWith('private:')))).catch(() => setRecents([])),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load videos.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [albumId, loadPage, requestAccess]
  );

  useEffect(() => {
    if (sort) {
      void refreshLibrary();
    }
    // Reload only once the saved sort is known, and whenever it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshLibrary, sort?.field, sort?.ascending]);

  // Originals deleted elsewhere (private-folder move): reload the list on return.
  useFocusEffect(
    useCallback(() => {
      if (consumeLibraryChanged()) {
        void refreshLibrary();
      }
    }, [refreshLibrary])
  );

  // Resume bars: re-read saved positions whenever the library comes back into focus.
  const videoIds = useMemo(() => videos.map((v) => v.id), [videos]);
  useFocusEffect(
    useCallback(() => {
      void getResumePositions(videoIds).then(setResume).catch(() => undefined);
    }, [videoIds])
  );

  // Size sort: use cached sizes, then measure the rest with limited concurrency.
  useEffect(() => {
    if (sort?.field !== 'size' || videos.length === 0) {
      return;
    }
    let cancelled = false;
    const pending: Record<string, number> = {};
    let flush: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      const known = await getKnownSizes(videos);
      if (cancelled) return;
      setSizes((cur) => ({ ...cur, ...known }));
      setMeasuring(true);
      await measureSizes(
        videos,
        (id, size) => {
          pending[id] = size;
          if (!flush) {
            flush = setTimeout(() => {
              flush = null;
              const batch = { ...pending };
              setSizes((cur) => ({ ...cur, ...batch }));
            }, 600);
          }
        },
        () => cancelled
      );
      if (!cancelled) {
        setSizes((cur) => ({ ...cur, ...pending }));
        setMeasuring(false);
      }
    })();
    return () => {
      cancelled = true;
      if (flush) clearTimeout(flush);
      setMeasuring(false);
    };
  }, [sort?.field, videos]);

  const chooseSort = useCallback((field: SortField) => {
    setSort((current) => {
      const base = current ?? DEFAULT_SORT;
      const next: SortOrder =
        base.field === field
          ? { field, ascending: !base.ascending }
          : { field, ascending: field === 'name' };
      void saveSortOrder(next);
      return next;
    });
  }, []);

  const openVideo = useCallback(
    (item: { id: string; title: string }) => {
      // The player resolves the playable URI itself (see src/lib/media-source.ts).
      router.push({
        pathname: '/player',
        params: { id: item.id, title: item.title },
      });
    },
    [router]
  );

  const filteredVideos = query.trim()
    ? videos.filter((item) =>
        item.title.toLowerCase().includes(query.trim().toLowerCase())
      )
    : videos;
  const activeSort = sort ?? DEFAULT_SORT;
  const shownVideos = isNativeSort(activeSort)
    ? filteredVideos
    : sortItems(
        filteredVideos.map((item) => ({ ...item, size: sizes[item.id] ?? null })),
        activeSort
      );
  const shownFolders = query.trim()
    ? folders.filter((item) =>
        item.title.toLowerCase().includes(query.trim().toLowerCase())
      )
    : folders;
  const shownRecents = query.trim()
    ? recents.filter((item) =>
        item.title.toLowerCase().includes(query.trim().toLowerCase())
      )
    : recents;

  const openFolder = (folder: FolderSummary) => {
    setAlbumId(folder.id);
    setAlbumTitle(folder.title);
    setTab('library');
    setQuery('');
    setLoading(true);
    void loadPage(0, true, folder.id).finally(() => setLoading(false));
  };

  const clearFolder = () => {
    setAlbumId(null);
    setAlbumTitle(null);
    setLoading(true);
    void loadPage(0, true, null).finally(() => setLoading(false));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Playsz</Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerBtn} onPress={() => router.push('/settings')}>
              <Text style={styles.headerBtnLabel}>Settings</Text>
            </Pressable>
            <Pressable style={styles.headerBtnAccent} onPress={() => router.push('/paywall')}>
              <Text style={styles.headerBtnAccentLabel}>{isPro ? 'Pro' : 'Unlock Pro'}</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.subtitle}>
          No ads. Your files stay standard and yours.
        </Text>
        {permission === 'granted' ? (
          <>
            <View style={styles.tabs}>
              {([
                ['library', 'Library'],
                ['folders', 'Folders'],
                ['recents', 'Recents'],
              ] as const).map(([id, label]) => (
                <Pressable
                  key={id}
                  style={[styles.tab, tab === id && styles.tabActive]}
                  onPress={() => setTab(id)}
                >
                  <Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                tab === 'folders'
                  ? 'Search folders'
                  : tab === 'recents'
                    ? 'Search recents'
                    : 'Search videos'
              }
              placeholderTextColor={colors.textMuted}
              style={styles.search}
            />
            {tab === 'library' ? (
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort</Text>
                {(Object.keys(SORT_LABELS) as SortField[]).map((field) => {
                  const active = activeSort.field === field;
                  return (
                    <Pressable
                      key={field}
                      style={[styles.sortChip, active && styles.tabActive]}
                      onPress={() => chooseSort(field)}
                      accessibilityLabel={`Sort by ${SORT_LABELS[field]}`}
                    >
                      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                        {SORT_LABELS[field]}
                        {active ? (activeSort.ascending ? ' ↑' : ' ↓') : ''}
                      </Text>
                    </Pressable>
                  );
                })}
                {measuring ? <ActivityIndicator size="small" color={colors.accent} /> : null}
              </View>
            ) : null}
            {albumTitle && tab === 'library' ? (
              <Pressable onPress={clearFolder}>
                <Text style={styles.folderChip}>Folder: {albumTitle}  ·  Show all</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>

      {permission === 'denied' ? (
        <View style={styles.message}>
          <Text style={styles.messageTitle}>Allow access to your videos</Text>
          <Text style={styles.messageBody}>
            Playsz only asks for video access so it can play files already on
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
            Video library access is available on Android and iOS. This
            preview cannot scan a library or play bundled sample media.
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && permission !== 'unsupported' && videos.length === 0 && tab !== 'recents' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.muted}>Scanning videos on this device…</Text>
        </View>
      ) : permission === 'granted' && tab === 'folders' ? (
        <FlatList
          data={shownFolders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={shownFolders.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refreshLibrary(true)}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.message}>
              <Text style={styles.messageTitle}>No folders found</Text>
              <Text style={styles.messageBody}>
                Folders come from albums on this device. Pull to refresh after
                videos are available.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => openFolder(item)}
            >
              <View style={styles.thumb}>
                <Text style={styles.thumbLabel}>📁</Text>
              </View>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </Pressable>
          )}
        />
      ) : permission === 'granted' && tab === 'recents' ? (
        <FlatList
          data={shownRecents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={shownRecents.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refreshLibrary(true)}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.message}>
              <Text style={styles.messageTitle}>No recent videos</Text>
              <Text style={styles.messageBody}>
                Videos you play are listed here from this device's resume
                history.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => openVideo(item)}
            >
              <VideoThumb request={{ cacheId: item.id, version: 0, assetId: item.id }} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.rowMeta}>
                  Played {new Date(item.playedAt).toLocaleString()}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : permission === 'granted' ? (
        <FlatList
          data={shownVideos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            shownVideos.length === 0 ? styles.emptyList : styles.list
          }
          onEndReached={() => {
            if (!loading && hasMore && !query.trim()) {
              void loadPage(offset, false, albumId);
            }
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refreshLibrary(true)}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.message}>
              <Text style={styles.messageTitle}>No videos on this device</Text>
              <Text style={styles.messageBody}>
                Copy a standard MP4 or MKV onto the phone, then pull to
                refresh. Playsz does not bundle sample videos.
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore && !query.trim() ? (
              <Pressable
                style={styles.loadMore}
                onPress={() => void loadPage(offset, false, albumId)}
              >
                <Text style={styles.loadMoreLabel}>
                  {loading ? 'Loading…' : 'Load more'}
                </Text>
              </Pressable>
            ) : query.trim() && hasMore ? (
              <Text style={styles.muted}>
                Search is filtering the videos already loaded. Load more from
                the library to widen the results.
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => openVideo(item)}
            >
              <VideoThumb
                request={{
                  cacheId: item.id,
                  version: item.modificationTime,
                  assetId: item.id,
                  durationSec: item.duration,
                }}
                durationSec={item.duration}
                progress={resumeFraction(resume[item.id], item.duration)}
              />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.rowMeta}>
                  {[
                    item.width && item.height
                      ? `${item.width}×${item.height}`
                      : null,
                    item.modificationTime
                      ? new Date(item.modificationTime).toLocaleDateString()
                      : null,
                    formatBytes(sizes[item.id]),
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

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      gap: 6,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerBtn: {
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    headerBtnLabel: {
      color: c.text,
      fontWeight: '700',
      fontSize: 12,
    },
    headerBtnAccent: {
      backgroundColor: c.accent,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    headerBtnAccentLabel: {
      color: c.accentDim,
      fontWeight: '800',
      fontSize: 12,
    },
    title: {
      color: c.text,
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    subtitle: {
      color: c.textMuted,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 360,
    },
    tabs: { flexDirection: 'row', gap: 8, marginTop: 8 },
    tab: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    tabActive: { backgroundColor: c.surfaceElevated, borderColor: c.accent },
    tabLabel: { color: c.textMuted, fontWeight: '700', fontSize: 12 },
    tabLabelActive: { color: c.text },
    search: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.inputBackground,
      color: c.text,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    sortRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    sortLabel: { color: c.textMuted, fontSize: 12, fontWeight: '700', marginRight: 2 },
    sortChip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    folderChip: { color: c.accent, fontWeight: '700', fontSize: 13, marginTop: 4 },
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
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowPressed: {
      opacity: 0.85,
      backgroundColor: c.surfaceElevated,
    },
    thumb: {
      width: 56,
      height: 56,
      borderRadius: 10,
      backgroundColor: c.accentDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbLabel: {
      color: c.accent,
      fontSize: 18,
    },
    rowBody: {
      flex: 1,
      gap: 4,
    },
    rowTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
    },
    rowMeta: {
      color: c.textMuted,
      fontSize: 13,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    muted: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: 'center',
      padding: 16,
    },
    message: {
      margin: 16,
      padding: 20,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      gap: 10,
    },
    messageTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
    },
    messageBody: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    cta: {
      alignSelf: 'flex-start',
      marginTop: 6,
      backgroundColor: c.accent,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    ctaLabel: {
      color: c.accentDim,
      fontWeight: '800',
      fontSize: 14,
    },
    loadMore: {
      alignSelf: 'center',
      marginVertical: 12,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    loadMoreLabel: { color: c.text, fontWeight: '700' },
    error: {
      color: c.danger,
      paddingHorizontal: 20,
      marginBottom: 8,
    },
  });
