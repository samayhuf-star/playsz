import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ThemeColors } from '@/constants/colors';
import { formatDuration as formatTimecode } from '@/lib/format';
import { resolveAssetUri } from '@/lib/media-source';
import { loadVideoPage, PAGE_SIZE, type LibraryItem } from '@/lib/library';
import { useColors, useThemedStyles } from '@/theme';

export type PickedVideo = {
  id: string;
  title: string;
  uri: string;
};

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (video: PickedVideo) => void;
};

export function VideoPickerModal({ visible, title, onClose, onPick }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextOffset: number, replace: boolean) => {
    setLoading(true);
    try {
      const page = await loadVideoPage({ offset: nextOffset });
      setItems((current) => (replace ? page : [...current, ...page]));
      setOffset(nextOffset + page.length);
      setHasMore(page.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load videos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery('');
      void load(0, true);
    }
  }, [load, visible]);

  const shown = query.trim()
    ? items.filter((item) =>
        item.title.toLowerCase().includes(query.trim().toLowerCase())
      )
    : items;

  const pick = async (item: LibraryItem) => {
    try {
      const uri = await resolveAssetUri(item.id);
      onPick({ id: item.id, title: item.title, uri });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that video.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.spacer} />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search videos"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (!loading && hasMore && !query.trim()) {
              void load(offset, false);
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            loading ? undefined : (
              <Text style={styles.empty}>No videos match this list.</Text>
            )
          }
          ListFooterComponent={
            loading ? <ActivityIndicator color={colors.accent} style={styles.spinner} /> : undefined
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => void pick(item)}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.rowMeta}>
                {item.duration != null ? formatTimecode(item.duration) : 'Video'}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background, paddingTop: 16 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    close: { color: c.accent, fontWeight: '700', width: 64 },
    spacer: { width: 64 },
    title: { flex: 1, color: c.text, textAlign: 'center', fontWeight: '700', fontSize: 16 },
    search: {
      marginHorizontal: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.inputBackground,
      color: c.text,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    list: { padding: 16, gap: 8, paddingBottom: 32 },
    row: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    rowTitle: { color: c.text, fontWeight: '600', fontSize: 15 },
    rowMeta: { color: c.textMuted, fontSize: 12 },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 24 },
    error: { color: c.danger, paddingHorizontal: 16, marginBottom: 8 },
    spinner: { marginVertical: 16 },
  });
