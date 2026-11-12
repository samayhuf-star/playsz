import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import type { ThemeColors } from '@/constants/colors';
import { formatDuration } from '@/lib/format';
import { useThumbnail, type ThumbnailRequest } from '@/lib/thumbnails';
import { useThemedStyles } from '@/theme';

type Props = {
  request: ThumbnailRequest | null;
  durationSec?: number | null;
  /** 0..1 watched fraction; 0 hides the bar. */
  progress?: number;
};

/** Library / private-folder thumbnail with duration badge and resume progress bar. */
export function VideoThumb({ request, durationSec, progress = 0 }: Props) {
  const styles = useThemedStyles(createStyles);
  const uri = useThumbnail(request);
  return (
    <View style={styles.thumb}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <Text style={styles.placeholder}>▶</Text>
      )}
      {durationSec != null && durationSec > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{formatDuration(durationSec)}</Text>
        </View>
      ) : null}
      {progress > 0 ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    thumb: {
      width: 112,
      height: 64,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholder: { color: c.textMuted, fontSize: 18 },
    badge: {
      position: 'absolute',
      right: 4,
      bottom: 6,
      backgroundColor: 'rgba(0,0,0,0.72)',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    badgeLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
    track: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 3,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    fill: { height: 3, backgroundColor: c.accent },
  });
