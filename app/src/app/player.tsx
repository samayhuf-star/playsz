import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useEvent } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Brightness from 'expo-brightness';

import { DarkColors as Colors } from '@/constants/colors';
import {
  formatTimecode,
  getResumePosition,
  recordRecentPlayback,
  saveResumePosition,
} from '@/lib/resume-position';
import {
  importSubtitleFile,
  loadSubtitleSelection,
  saveSubtitleOffset,
} from '@/lib/subtitle-prefs';
import { cueAtTime, type SubtitleCue } from '@/lib/subtitles';

type GestureHint = {
  label: string;
  detail: string;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{
    id?: string | string[];
    uri?: string | string[];
    title?: string | string[];
  }>();

  const assetId = firstParam(params.id);
  const uri = firstParam(params.uri);
  const title = firstParam(params.title) || 'Video';

  const player = useVideoPlayer(null, (instance) => {
    instance.timeUpdateEventInterval = 1;
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const timeUpdate = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  const [controlsVisible, setControlsVisible] = useState(true);
  const [hint, setHint] = useState<GestureHint | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [subtitleName, setSubtitleName] = useState<string | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedUri = useRef<string | null>(null);
  const assetIdRef = useRef(assetId);
  assetIdRef.current = assetId;
  const brightnessRef = useRef(1);
  const volumeRef = useRef(1);
  const startBrightnessRef = useRef(1);
  const startVolumeRef = useRef(1);

  const currentTime = timeUpdate.currentTime ?? 0;

  const persistPosition = useCallback(() => {
    const id = assetIdRef.current;
    if (!id) {
      return;
    }
    void saveResumePosition(id, player.currentTime, player.duration);
  }, [player]);

  const showHint = useCallback((next: GestureHint) => {
    setHint(next);
    if (hintTimer.current) {
      clearTimeout(hintTimer.current);
    }
    hintTimer.current = setTimeout(() => setHint(null), 900);
  }, []);

  const toggleControls = useCallback(() => {
    setControlsVisible((visible) => !visible);
  }, []);

  const skipBy = useCallback(
    (delta: number, side: 'left' | 'right') => {
      const next = Math.max(0, player.currentTime + delta);
      player.currentTime = next;
      showHint({
        label: delta > 0 ? '+10s' : '−10s',
        detail:
          side === 'left'
            ? 'Double-tap left to skip back'
            : 'Double-tap right to skip ahead',
      });
      persistPosition();
    },
    [persistPosition, player, showHint]
  );

  const seekToRatio = useCallback(
    (ratio: number) => {
      const length = player.duration;
      if (!length || length <= 0) {
        showHint({
          label: 'Seek',
          detail: 'Horizontal swipe seeks once duration is known',
        });
        return;
      }
      const next = Math.min(Math.max(ratio, 0), 1) * length;
      player.currentTime = next;
      showHint({
        label: formatTimecode(next),
        detail: 'Horizontal swipe to seek',
      });
      persistPosition();
    },
    [persistPosition, player, showHint]
  );

  const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

  const markVerticalStart = useCallback(() => {
    startBrightnessRef.current = brightnessRef.current;
    startVolumeRef.current = volumeRef.current;
  }, []);

  const onVerticalGesture = useCallback(
    (side: 'left' | 'right', translationY: number) => {
      if (side === 'left') {
        const next = clampUnit(startBrightnessRef.current - translationY / 280);
        brightnessRef.current = next;
        void Brightness.setBrightnessAsync(next);
        showHint({
          label: `${Math.round(next * 100)}%`,
          detail: 'Brightness',
        });
      } else {
        const next = clampUnit(startVolumeRef.current - translationY / 280);
        volumeRef.current = next;
        player.volume = next;
        showHint({
          label: `${Math.round(next * 100)}%`,
          detail: 'Playback volume',
        });
      }
    },
    [player, showHint]
  );

  const changeOffset = useCallback(
    (delta: number) => {
      const id = assetIdRef.current;
      setSubtitleOffset((current) => {
        const next = Math.round((current + delta) * 10) / 10;
        if (id) {
          void saveSubtitleOffset(id, next);
        }
        return next;
      });
    },
    []
  );

  const onImportSubtitles = useCallback(async () => {
    const id = assetIdRef.current;
    if (!id) {
      setError('Play a library video before importing subtitles.');
      return;
    }
    try {
      const loaded = await importSubtitleFile(id);
      if (!loaded) {
        return;
      }
      setCues(loaded.cues);
      setSubtitleName(loaded.selection.name);
      setSubtitleOffset(loaded.selection.offset);
      showHint({
        label: 'Subtitles',
        detail: `${loaded.selection.name} · ${loaded.cues.length} cues`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import subtitles.');
    }
  }, [showHint]);

  const togglePlayback = useCallback(() => {
    if (player.playing) {
      player.pause();
      persistPosition();
    } else {
      void player.play();
    }
  }, [persistPosition, player]);

  useEffect(() => {
    void Brightness.getBrightnessAsync()
      .then((value) => {
        if (Number.isFinite(value)) {
          brightnessRef.current = value;
        }
      })
      .catch(() => {
        // Window brightness stays at the last known value.
      });
  }, []);

  useEffect(() => {
    if (!uri) {
      setError('Missing video URI.');
      return;
    }
    if (loadedUri.current === uri) {
      return;
    }
    let cancelled = false;
    loadedUri.current = uri;

    const load = async () => {
      try {
        await player.replaceAsync({
          uri,
          metadata: { title },
        });
        if (cancelled) {
          return;
        }
        const length = player.duration || 0;
        setDuration(length);
        const resumeAt = assetId
          ? await getResumePosition(assetId, length)
          : null;
        if (cancelled) {
          return;
        }
        if (resumeAt != null) {
          player.currentTime = resumeAt;
          setResumeNotice(`Resumed at ${formatTimecode(resumeAt)}`);
          setTimeout(() => setResumeNotice(null), 2200);
        }
        volumeRef.current = player.volume ?? 1;
        if (assetId) {
          void recordRecentPlayback({ id: assetId, title });
          const loadedSubs = await loadSubtitleSelection(assetId);
          if (!cancelled && loadedSubs) {
            setCues(loadedSubs.cues);
            setSubtitleName(loadedSubs.selection.name);
            setSubtitleOffset(loadedSubs.selection.offset);
          }
        }
        player.play();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'This video could not be opened.'
          );
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [assetId, player, title, uri]);

  useEffect(() => {
    const length = player.duration;
    if (length && length !== duration) {
      setDuration(length);
    }
  }, [currentTime, duration, player.duration]);

  useEffect(() => {
    if (controlsVisible && isPlaying) {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      hideTimer.current = setTimeout(() => setControlsVisible(false), 2800);
    }
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [controlsVisible, isPlaying, currentTime]);

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      const id = assetIdRef.current;
      if (id) {
        void saveResumePosition(id, 0, player.duration);
      }
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    return () => {
      persistPosition();
      if (hintTimer.current) {
        clearTimeout(hintTimer.current);
      }
    };
  }, [persistPosition]);

  const composedGesture = useMemo(() => {
    const singleTap = Gesture.Tap()
      .maxDuration(250)
      .onEnd(() => {
        runOnJS(toggleControls)();
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event) => {
        const side = event.x < windowWidth / 2 ? 'left' : 'right';
        runOnJS(skipBy)(side === 'left' ? -10 : 10, side);
      });

    const pan = Gesture.Pan()
      .activeOffsetX([-16, 16])
      .failOffsetY([-24, 24])
      .onEnd((event) => {
        const ratio = event.x / windowWidth;
        runOnJS(seekToRatio)(ratio);
      });

    const vertical = Gesture.Pan()
      .activeOffsetY([-16, 16])
      .failOffsetX([-24, 24])
      .onBegin(() => {
        runOnJS(markVerticalStart)();
      })
      .onUpdate((event) => {
        const side = event.x < windowWidth / 2 ? 'left' : 'right';
        runOnJS(onVerticalGesture)(side, event.translationY);
      });

    return Gesture.Race(
      Gesture.Exclusive(doubleTap, singleTap),
      pan,
      vertical
    );
  }, [
    markVerticalStart,
    onVerticalGesture,
    seekToRatio,
    skipBy,
    toggleControls,
    windowWidth,
  ]);

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    <View style={styles.root}>
      <StatusBar style="light" hidden />
      <GestureDetector gesture={composedGesture}>
        <View style={styles.stage}>
          {uri ? (
            <VideoView
              style={styles.video}
              player={player}
              nativeControls={false}
              contentFit="contain"
              startsPictureInPictureAutomatically={false}
            />
          ) : null}
        </View>
      </GestureDetector>

      {hint ? (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintLabel}>{hint.label}</Text>
          <Text style={styles.hintDetail}>{hint.detail}</Text>
        </View>
      ) : null}

      {resumeNotice ? (
        <View
          style={[styles.resume, { top: insets.top + 56 }]}
          pointerEvents="none"
        >
          <Text style={styles.resumeText}>{resumeNotice}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {(() => {
        const cue = cues.length ? cueAtTime(cues, currentTime, subtitleOffset) : null;
        return cue ? (
          <View style={[styles.subtitleBox, { bottom: controlsVisible ? 88 + insets.bottom : 28 + insets.bottom }]} pointerEvents="none">
            <Text style={styles.subtitleText}>{cue.text}</Text>
          </View>
        ) : null;
      })()}

      {controlsVisible ? (
        <View style={styles.controls} pointerEvents="box-none">
          <View
            style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.back}>‹ Back</Text>
            </Pressable>
            <Text style={styles.videoTitle} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={() => void onImportSubtitles()} hitSlop={12} style={styles.subBtn}>
              <Text style={styles.subBtnLabel}>Subs</Text>
            </Pressable>
          </View>

          <View style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <View style={styles.bottomBar}>
              <Pressable style={styles.playBtn} onPress={togglePlayback}>
                <Text style={styles.playLabel}>{isPlaying ? 'Pause' : 'Play'}</Text>
              </Pressable>
              <Text style={styles.time}>{formatTimecode(currentTime)}</Text>
              <View style={styles.track}>
                <View style={[styles.trackFill, { flex: progress }]} />
                <View style={{ flex: Math.max(1 - progress, 0.0001) }} />
              </View>
              <Text style={styles.time}>{formatTimecode(duration)}</Text>
            </View>
            {cues.length ? (
              <View style={styles.subRow}>
                <Text style={styles.subMeta} numberOfLines={1}>
                  {subtitleName} · offset {subtitleOffset >= 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s
                </Text>
                <Pressable onPress={() => changeOffset(-0.1)} style={styles.offsetBtn}>
                  <Text style={styles.offsetLabel}>−0.1</Text>
                </Pressable>
                <Pressable onPress={() => changeOffset(0.1)} style={styles.offsetBtn}>
                  <Text style={styles.offsetLabel}>+0.1</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {Platform.OS === 'web' && !controlsVisible ? (
        <View style={styles.webHint} pointerEvents="none">
          <Text style={styles.hintDetail}>Tap for controls</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.playerBg,
  },
  stage: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.playerBg,
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  controls: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    backgroundColor: Colors.overlay,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  back: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    width: 64,
  },
  backSpacer: {
    width: 64,
  },
  videoTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  playBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  playLabel: {
    color: Colors.accentDim,
    fontWeight: '800',
    fontSize: 13,
  },
  time: {
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    minWidth: 40,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  trackFill: {
    backgroundColor: Colors.accent,
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    minWidth: 160,
  },
  hintLabel: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  hintDetail: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  resume: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  resumeText: {
    color: Colors.accent,
    fontWeight: '700',
  },
  errorBox: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 120,
    backgroundColor: 'rgba(80,16,16,0.9)',
    padding: 14,
    borderRadius: 12,
  },
  errorText: {
    color: Colors.text,
    textAlign: 'center',
  },
  webHint: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
  },
  subBtn: {
    minWidth: 64,
    alignItems: 'flex-end',
  },
  subBtnLabel: {
    color: Colors.accent,
    fontWeight: '800',
    fontSize: 14,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  subMeta: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 11,
  },
  offsetBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  offsetLabel: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  subtitleBox: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  subtitleText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
