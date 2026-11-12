import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { formatDuration } from '@/lib/format';
import { forgetResolvedUri, isAssetInCloud, resolveAssetUri } from '@/lib/media-source';
import { findPrivateItem, privateItemUri } from '@/lib/private-folder';
import { usePrivateUnlocked } from '@/lib/private-lock';
import {
  getResumePosition,
  recordRecentPlayback,
  saveResumePosition,
} from '@/lib/resume-position';
import {
  DEFAULT_SUBTITLE_STYLE,
  importSubtitleFile,
  loadPlayerPrefs,
  loadSubtitleSelection,
  loadSubtitleStyle,
  PLAYBACK_RATES,
  savePlayerPrefs,
  saveSubtitleOffset,
  saveSubtitleStyle,
  SUBTITLE_BACKGROUNDS,
  SUBTITLE_COLORS,
  SUBTITLE_SIZES,
  type SubtitleBackground,
  type SubtitleColor,
  type SubtitleSize,
  type SubtitleStyle,
} from '@/lib/subtitle-prefs';
import { cueAtTime, type SubtitleCue } from '@/lib/subtitles';

type GestureHint = {
  label: string;
  detail: string;
};

type Panel = 'speed' | 'subtitles' | null;

/** Full screen width of horizontal swipe = this many seconds. */
const SWIPE_SECONDS_PER_WIDTH = 90;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function rateLabel(rate: number): string {
  return `${Number.isInteger(rate) ? rate.toFixed(0) : String(rate)}x`;
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

  /** Library asset id (ph:// on iOS, content:// on Android) or `private:<id>`. */
  const assetId = firstParam(params.id);
  const legacyUri = firstParam(params.uri);
  const title = firstParam(params.title) || 'Video';
  const isPrivate = assetId.startsWith('private:');
  const privateUnlocked = usePrivateUnlocked();

  const player = useVideoPlayer(null, (instance) => {
    // 4 updates a second: smooth progress and accurate enough for A-B repeat.
    instance.timeUpdateEventInterval = 0.25;
    instance.preservesPitch = true;
  });
  const videoViewRef = useRef<VideoView>(null);

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const timeUpdate = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  const [controlsVisible, setControlsVisible] = useState(true);
  const [hint, setHint] = useState<GestureHint | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [duration, setDuration] = useState(0);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [subtitleName, setSubtitleName] = useState<string | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [subStyle, setSubStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [abA, setAbA] = useState<number | null>(null);
  const [abB, setAbB] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockHintVisible, setLockHintVisible] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [inPip, setInPip] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedId = useRef<string | null>(null);
  const triedFallback = useRef(false);
  const resumeApplied = useRef(false);
  const assetIdRef = useRef(assetId);
  assetIdRef.current = assetId;
  const brightnessRef = useRef(1);
  const initialBrightnessRef = useRef<number | null>(null);
  const volumeRef = useRef(1);
  const startBrightnessRef = useRef(1);
  const startVolumeRef = useRef(1);
  const seekStartRef = useRef(0);
  const seekTargetRef = useRef<number | null>(null);

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
    setPanel(null);
  }, []);

  const showLockHint = useCallback(() => {
    setLockHintVisible(true);
    if (lockHintTimer.current) {
      clearTimeout(lockHintTimer.current);
    }
    lockHintTimer.current = setTimeout(() => setLockHintVisible(false), 2500);
  }, []);

  const skipBy = useCallback(
    (delta: number, side: 'left' | 'right') => {
      const length = player.duration || Number.POSITIVE_INFINITY;
      const next = Math.min(Math.max(0, player.currentTime + delta), length);
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

  const beginSeek = useCallback(() => {
    seekStartRef.current = player.currentTime;
    seekTargetRef.current = null;
  }, [player]);

  const updateSeek = useCallback(
    (translationX: number) => {
      const length = player.duration;
      if (!length || length <= 0) {
        return;
      }
      const delta = (translationX / Math.max(windowWidth, 1)) * SWIPE_SECONDS_PER_WIDTH;
      const target = Math.min(Math.max(seekStartRef.current + delta, 0), length);
      seekTargetRef.current = target;
      const diff = Math.round(target - seekStartRef.current);
      showHint({
        label: formatDuration(target),
        detail: `${diff >= 0 ? '+' : '−'}${Math.abs(diff)}s · swipe to seek`,
      });
    },
    [player, showHint, windowWidth]
  );

  const endSeek = useCallback(() => {
    const target = seekTargetRef.current;
    if (target != null) {
      player.currentTime = target;
      persistPosition();
    }
    seekTargetRef.current = null;
  }, [persistPosition, player]);

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
        void Brightness.setBrightnessAsync(next).catch(() => undefined);
        showHint({
          label: `${Math.round(next * 100)}%`,
          detail: 'Brightness',
        });
      } else {
        // Player volume (0..1). System volume would need a third-party native SDK.
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

  const changeOffset = useCallback((delta: number) => {
    const id = assetIdRef.current;
    setSubtitleOffset((current) => {
      const next = Math.round((current + delta) * 10) / 10;
      if (id) {
        void saveSubtitleOffset(id, next);
      }
      return next;
    });
  }, []);

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
      player.play();
    }
  }, [persistPosition, player]);

  const updateSubStyle = useCallback((patch: Partial<SubtitleStyle>) => {
    setSubStyle((current) => {
      const next = { ...current, ...patch };
      void saveSubtitleStyle(next);
      return next;
    });
  }, []);

  const chooseRate = useCallback(
    (next: number) => {
      setRate(next);
      player.playbackRate = next;
      void savePlayerPrefs({ rate: next, loop });
    },
    [loop, player]
  );

  const toggleLoop = useCallback(() => {
    const next = !loop;
    setLoop(next);
    player.loop = next;
    void savePlayerPrefs({ rate, loop: next });
    showHint({ label: next ? 'Loop on' : 'Loop off', detail: 'Repeat this video' });
  }, [loop, player, rate, showHint]);

  const cycleAb = useCallback(() => {
    const now = player.currentTime;
    if (abA == null) {
      setAbA(now);
      showHint({ label: `A ${formatDuration(now)}`, detail: 'Tap A-B again to set B' });
    } else if (abB == null) {
      if (now <= abA + 0.5) {
        showHint({ label: 'B must be after A', detail: `A is ${formatDuration(abA)}` });
        return;
      }
      setAbB(now);
      player.currentTime = abA;
      showHint({
        label: `${formatDuration(abA)} → ${formatDuration(now)}`,
        detail: 'A-B repeat on. Tap A-B to clear',
      });
    } else {
      setAbA(null);
      setAbB(null);
      showHint({ label: 'A-B off', detail: 'Repeat cleared' });
    }
  }, [abA, abB, player, showHint]);

  const lockScreen = useCallback(() => {
    setLocked(true);
    setControlsVisible(false);
    setPanel(null);
    showLockHint();
  }, [showLockHint]);

  const unlockScreen = useCallback(() => {
    setLocked(false);
    setLockHintVisible(false);
    setControlsVisible(true);
  }, []);

  const startPip = useCallback(() => {
    void videoViewRef.current?.startPictureInPicture().catch(() => {
      setError('Picture in picture is not available on this device.');
    });
  }, []);

  // ---- Saved prefs ----
  useEffect(() => {
    void loadSubtitleStyle().then(setSubStyle);
    void loadPlayerPrefs().then((prefs) => {
      setRate(prefs.rate);
      setLoop(prefs.loop);
      player.playbackRate = prefs.rate;
      player.loop = prefs.loop;
    });
  }, [player]);

  // ---- Background audio / now playing (not for private-folder items) ----
  useEffect(() => {
    player.staysActiveInBackground = !isPrivate;
    player.showNowPlayingNotification = !isPrivate;
  }, [isPrivate, player]);

  // ---- Private items: leave as soon as the folder locks (app went to background) ----
  useEffect(() => {
    if (isPrivate && !privateUnlocked) {
      player.pause();
      persistPosition();
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }
  }, [isPrivate, persistPosition, player, privateUnlocked, router]);

  // ---- Brightness: remember the starting value and restore it on exit ----
  useEffect(() => {
    void Brightness.getBrightnessAsync()
      .then((value) => {
        if (Number.isFinite(value)) {
          brightnessRef.current = value;
          initialBrightnessRef.current = value;
        }
      })
      .catch(() => {
        // Window brightness stays at the last known value.
      });
    return () => {
      if (Platform.OS === 'android') {
        void Brightness.restoreSystemBrightnessAsync().catch(() => undefined);
      } else if (initialBrightnessRef.current != null) {
        void Brightness.setBrightnessAsync(initialBrightnessRef.current).catch(() => undefined);
      }
    };
  }, []);

  // ---- Resolve the asset to a playable URI and load it ----
  useEffect(() => {
    if (!assetId && !legacyUri) {
      setError('Missing video.');
      setPreparing(false);
      return;
    }
    const loadKey = assetId || legacyUri;
    if (loadedId.current === loadKey) {
      return;
    }
    loadedId.current = loadKey;
    triedFallback.current = false;
    resumeApplied.current = false;
    let cancelled = false;

    const load = async () => {
      try {
        setPreparing(true);
        let uri: string;
        if (isPrivate) {
          const item = await findPrivateItem(assetId);
          if (!item) {
            throw new Error('That private-folder item is no longer on this device.');
          }
          uri = privateItemUri(item);
        } else if (assetId) {
          if (await isAssetInCloud(assetId)) {
            setResumeNotice('Downloading from iCloud');
          }
          // Root cause of the blank player: the screen used to be handed a URI string
          // resolved earlier on the library screen and never surfaced load errors.
          // Resolve here, right before playback (iCloud download allowed).
          uri = await resolveAssetUri(assetId);
        } else {
          uri = legacyUri;
        }
        if (cancelled) {
          return;
        }
        await player.replaceAsync({ uri, metadata: { title } });
        if (cancelled) {
          return;
        }
        volumeRef.current = player.volume ?? 1;
        if (assetId) {
          if (!isPrivate) {
            // Private titles never appear in the library's Recents.
            void recordRecentPlayback({ id: assetId, title });
          }
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
          setPreparing(false);
          setResumeNotice(null);
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
  }, [assetId, isPrivate, legacyUri, player, title]);

  // ---- Player status: surface errors (they never throw from replaceAsync) ----
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status: next, error: playerError }) => {
      if (next === 'readyToPlay') {
        setPreparing(false);
        setError(null);
        const length = player.duration || 0;
        setDuration(length);
        if (!resumeApplied.current) {
          resumeApplied.current = true;
          setResumeNotice(null);
          const id = assetIdRef.current;
          if (id) {
            void getResumePosition(id, length).then((resumeAt) => {
              if (resumeAt != null) {
                player.currentTime = resumeAt;
                setResumeNotice(`Resumed at ${formatDuration(resumeAt)}`);
                setTimeout(() => setResumeNotice(null), 2200);
              }
            });
          }
        }
      } else if (next === 'error') {
        const id = assetIdRef.current;
        // One retry: hand the media-library id straight to expo-video, which resolves
        // ph:// itself on iOS (with sandbox access and iCloud download) and plays
        // content:// on Android.
        if (id && !id.startsWith('private:') && !triedFallback.current) {
          triedFallback.current = true;
          forgetResolvedUri(id);
          void player
            .replaceAsync({ uri: id, metadata: { title } })
            .then(() => player.play())
            .catch(() => undefined);
          return;
        }
        setPreparing(false);
        setError(playerError?.message || 'This video could not be played.');
      }
    });
    return () => sub.remove();
  }, [player, title]);

  useEffect(() => {
    const length = player.duration;
    if (length && length !== duration) {
      setDuration(length);
    }
  }, [currentTime, duration, player.duration]);

  // ---- A-B repeat ----
  useEffect(() => {
    if (abA != null && abB != null && currentTime >= abB) {
      player.currentTime = abA;
    }
  }, [abA, abB, currentTime, player]);

  useEffect(() => {
    if (controlsVisible && isPlaying && panel == null) {
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
  }, [controlsVisible, isPlaying, currentTime, panel]);

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
      if (lockHintTimer.current) {
        clearTimeout(lockHintTimer.current);
      }
    };
  }, [persistPosition]);

  const composedGesture = useMemo(() => {
    if (locked) {
      // Screen lock: every gesture is ignored except a tap that reveals the unlock button.
      return Gesture.Tap().onEnd(() => {
        runOnJS(showLockHint)();
      });
    }

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
      .onStart(() => {
        runOnJS(beginSeek)();
      })
      .onUpdate((event) => {
        runOnJS(updateSeek)(event.translationX);
      })
      .onEnd(() => {
        runOnJS(endSeek)();
      });

    const vertical = Gesture.Pan()
      .activeOffsetY([-16, 16])
      .failOffsetX([-24, 24])
      .onStart(() => {
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
    beginSeek,
    endSeek,
    locked,
    markVerticalStart,
    onVerticalGesture,
    showLockHint,
    skipBy,
    toggleControls,
    updateSeek,
    windowWidth,
  ]);

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const abStartFrac = duration > 0 && abA != null ? Math.min(abA / duration, 1) : null;
  const abEndFrac = duration > 0 && abB != null ? Math.min(abB / duration, 1) : null;
  const cue = cues.length ? cueAtTime(cues, currentTime, subtitleOffset) : null;
  const subBg = SUBTITLE_BACKGROUNDS[subStyle.background].value;
  const showSpinner = (preparing || status === 'loading') && !error;

  return (
    <View style={styles.root} testID="player-screen">
      <StatusBar style="light" hidden />
      <GestureDetector gesture={composedGesture}>
        <View style={styles.stage} collapsable={false} testID="player-stage">
          {/* VideoView gets explicit full-stage geometry plus contentFit, so it never
              collapses to 0x0 inside the gesture wrapper. */}
          <VideoView
            ref={videoViewRef}
            style={StyleSheet.absoluteFill}
            player={player}
            nativeControls={false}
            contentFit="contain"
            allowsPictureInPicture={!isPrivate}
            startsPictureInPictureAutomatically={!isPrivate}
            onPictureInPictureStart={() => setInPip(true)}
            onPictureInPictureStop={() => setInPip(false)}
          />
        </View>
      </GestureDetector>

      {showSpinner ? (
        <View style={styles.spinner} pointerEvents="none">
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : null}

      {hint ? (
        <View style={styles.hint} pointerEvents="none" testID="player-hint">
          <Text style={styles.hintLabel} testID="player-hint-label">{hint.label}</Text>
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
        <View style={styles.errorBox} testID="player-error">
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => router.back()} style={styles.errorBtn}>
            <Text style={styles.errorBtnLabel}>Back to library</Text>
          </Pressable>
        </View>
      ) : null}

      {cue && !inPip ? (
        <View
          style={[
            styles.subtitleBox,
            { bottom: controlsVisible ? 120 + insets.bottom : 28 + insets.bottom },
          ]}
          pointerEvents="none"
        >
          <Text
            testID="player-subtitle-text"
            style={[
              styles.subtitleText,
              {
                color: SUBTITLE_COLORS[subStyle.color].value,
                fontSize: SUBTITLE_SIZES[subStyle.size].fontSize,
                lineHeight: Math.round(SUBTITLE_SIZES[subStyle.size].fontSize * 1.3),
                backgroundColor: subBg,
                textShadowRadius: subStyle.background === 'shadow' ? 4 : 0,
              },
              subStyle.background !== 'shadow' && styles.subtitleBoxed,
            ]}
          >
            {cue.text}
          </Text>
        </View>
      ) : null}

      {locked ? (
        lockHintVisible ? (
          <View style={[styles.lockOverlay, { paddingTop: Math.max(insets.top, 16) }]}>
            <Pressable style={styles.unlockBtn} onPress={unlockScreen} hitSlop={12}>
              <Text style={styles.unlockLabel}>🔒 Tap to unlock</Text>
            </Pressable>
          </View>
        ) : null
      ) : controlsVisible ? (
        <View style={styles.controls} pointerEvents="box-none">
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
            <Pressable testID="player-back" onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.back}>‹ Back</Text>
            </Pressable>
            <Text style={styles.videoTitle} numberOfLines={1} testID="player-title">
              {title}
            </Text>
            <Pressable testID="player-lock" onPress={lockScreen} hitSlop={12} style={styles.topBtn}>
              <Text style={styles.subBtnLabel}>Lock</Text>
            </Pressable>
          </View>

          <View style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            {panel === 'speed' ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Playback speed</Text>
                <View style={styles.chipRow}>
                  {PLAYBACK_RATES.map((value) => (
                    <Pressable
                      key={value}
                      style={[styles.chip, rate === value && styles.chipActive]}
                      onPress={() => chooseRate(value)}
                    >
                      <Text style={[styles.chipLabel, rate === value && styles.chipLabelActive]}>
                        {rateLabel(value)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {panel === 'subtitles' ? (
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Subtitles</Text>
                  <Pressable testID="player-load-srt" onPress={() => void onImportSubtitles()} style={styles.chip}>
                    <Text style={styles.chipLabel}>{cues.length ? 'Replace .srt' : 'Load .srt'}</Text>
                  </Pressable>
                </View>
                {cues.length ? (
                  <View style={styles.chipRow}>
                    <Text style={styles.subMeta} numberOfLines={1}>
                      {subtitleName} · offset {subtitleOffset >= 0 ? '+' : ''}
                      {subtitleOffset.toFixed(1)}s
                    </Text>
                    <Pressable onPress={() => changeOffset(-0.1)} style={styles.chip}>
                      <Text style={styles.chipLabel}>−0.1</Text>
                    </Pressable>
                    <Pressable onPress={() => changeOffset(0.1)} style={styles.chip}>
                      <Text style={styles.chipLabel}>+0.1</Text>
                    </Pressable>
                  </View>
                ) : null}
                <Text style={styles.panelLabel}>Size</Text>
                <View style={styles.chipRow}>
                  {(Object.keys(SUBTITLE_SIZES) as SubtitleSize[]).map((key) => (
                    <Pressable
                      key={key}
                      style={[styles.chip, subStyle.size === key && styles.chipActive]}
                      onPress={() => updateSubStyle({ size: key })}
                    >
                      <Text style={[styles.chipLabel, subStyle.size === key && styles.chipLabelActive]}>
                        {SUBTITLE_SIZES[key].label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.panelLabel}>Colour</Text>
                <View style={styles.chipRow}>
                  {(Object.keys(SUBTITLE_COLORS) as SubtitleColor[]).map((key) => (
                    <Pressable
                      key={key}
                      style={[styles.chip, subStyle.color === key && styles.chipActive]}
                      onPress={() => updateSubStyle({ color: key })}
                    >
                      <Text style={[styles.chipLabel, { color: SUBTITLE_COLORS[key].value }]}>
                        {SUBTITLE_COLORS[key].label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.panelLabel}>Background</Text>
                <View style={styles.chipRow}>
                  {(Object.keys(SUBTITLE_BACKGROUNDS) as SubtitleBackground[]).map((key) => (
                    <Pressable
                      key={key}
                      style={[styles.chip, subStyle.background === key && styles.chipActive]}
                      onPress={() => updateSubStyle({ background: key })}
                    >
                      <Text
                        style={[styles.chipLabel, subStyle.background === key && styles.chipLabelActive]}
                      >
                        {SUBTITLE_BACKGROUNDS[key].label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.bottomBar}>
              <Pressable style={styles.playBtn} testID="player-play-pause" onPress={togglePlayback}>
                <Text style={styles.playLabel}>{isPlaying ? 'Pause' : 'Play'}</Text>
              </Pressable>
              <Text style={styles.time} testID="player-current-time">{formatDuration(currentTime)}</Text>
              <View style={styles.track} testID="player-seek-bar">
                <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
                {abStartFrac != null ? (
                  <View style={[styles.abMark, { left: `${abStartFrac * 100}%` }]} />
                ) : null}
                {abEndFrac != null ? (
                  <View style={[styles.abMark, { left: `${abEndFrac * 100}%` }]} />
                ) : null}
              </View>
              <Text style={styles.time} testID="player-duration">{formatDuration(duration)}</Text>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                testID="player-speed"
                style={[styles.chip, panel === 'speed' && styles.chipActive]}
                onPress={() => setPanel((p) => (p === 'speed' ? null : 'speed'))}
              >
                <Text style={[styles.chipLabel, panel === 'speed' && styles.chipLabelActive]}>
                  {rateLabel(rate)}
                </Text>
              </Pressable>
              <Pressable testID="player-loop" style={[styles.chip, loop && styles.chipActive]} onPress={toggleLoop}>
                <Text style={[styles.chipLabel, loop && styles.chipLabelActive]}>Loop</Text>
              </Pressable>
              <Pressable testID="player-ab" style={[styles.chip, abA != null && styles.chipActive]} onPress={cycleAb}>
                <Text style={[styles.chipLabel, abA != null && styles.chipLabelActive]}>
                  {abA == null ? 'A-B' : abB == null ? 'Set B' : 'A-B ✕'}
                </Text>
              </Pressable>
              <Pressable
                testID="player-subs"
                style={[styles.chip, (panel === 'subtitles' || cues.length > 0) && styles.chipActive]}
                onPress={() => setPanel((p) => (p === 'subtitles' ? null : 'subtitles'))}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    (panel === 'subtitles' || cues.length > 0) && styles.chipLabelActive,
                  ]}
                >
                  Subs
                </Text>
              </Pressable>
              {!isPrivate && Platform.OS !== 'web' ? (
                <Pressable style={styles.chip} testID="player-pip" onPress={startPip}>
                  <Text style={styles.chipLabel}>PiP</Text>
                </Pressable>
              ) : null}
            </View>
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
  spinner: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
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
  topBtn: {
    minWidth: 64,
    alignItems: 'flex-end',
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
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
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    backgroundColor: Colors.accent,
  },
  abMark: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: 4,
    backgroundColor: '#FFE45C',
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(110,231,160,0.15)',
  },
  chipLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  chipLabelActive: {
    color: Colors.accent,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  panel: {
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 12,
    gap: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(12,14,20,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  panelLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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
    top: '40%',
    backgroundColor: 'rgba(80,16,16,0.92)',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    alignItems: 'center',
  },
  errorText: {
    color: Colors.text,
    textAlign: 'center',
  },
  errorBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  errorBtnLabel: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  webHint: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
  },
  subBtnLabel: {
    color: Colors.accent,
    fontWeight: '800',
    fontSize: 14,
  },
  subMeta: {
    flexShrink: 1,
    color: Colors.textMuted,
    fontSize: 11,
  },
  subtitleBox: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  subtitleText: {
    textAlign: 'center',
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
  },
  subtitleBoxed: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  unlockBtn: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  unlockLabel: {
    color: Colors.text,
    fontWeight: '800',
  },
});
