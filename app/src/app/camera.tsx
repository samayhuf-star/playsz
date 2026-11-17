import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addPrivateItem } from '@/lib/private-folder';
import { usePrivateUnlocked } from '@/lib/private-lock';
import { useIapContext } from '@/providers/iap-provider';

/**
 * Private camera. Photos and videos captured here are copied straight into the
 * app-private vault folder and never written to the Photos library.
 * Camera and microphone are used only while this screen is open.
 */
export default function PrivateCameraScreen() {
  const router = useRouter();
  const unlocked = usePrivateUnlocked();
  const { isPro } = useIapContext();
  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!unlocked) router.replace('/private-folder');
  }, [unlocked, router]);

  const save = useCallback(
    async (uri: string, ext: 'jpg' | 'mp4') => {
      const name = `${ext === 'jpg' ? 'Photo' : 'Video'} ${new Date().toLocaleString()}.${ext}`;
      const result = await addPrivateItem({ sourceUri: uri, filename: name, isPro });
      if (!result.allowed) {
        Alert.alert('Vault is full', 'Unlock Dimmer Pro for unlimited private items.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'See Pro', onPress: () => router.push('/paywall') },
        ]);
        return;
      }
      setNote(`Saved to vault (${result.count} item${result.count === 1 ? '' : 's'}).`);
    },
    [isPro, router]
  );

  const shoot = async () => {
    try {
      if (mode === 'picture') {
        const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
        if (photo?.uri) await save(photo.uri, 'jpg');
        return;
      }
      if (recording) {
        cameraRef.current?.stopRecording();
        return;
      }
      setRecording(true);
      const video = await cameraRef.current?.recordAsync({ maxDuration: 600 });
      setRecording(false);
      if (video?.uri) await save(video.uri, 'mp4');
    } catch (err) {
      setRecording(false);
      setNote(err instanceof Error ? err.message : 'Capture failed.');
    }
  };

  const needsMic = mode === 'video' && micPerm && !micPerm.granted;

  if (!camPerm) return <View style={styles.fill} />;

  if (!camPerm.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.body}>
          Dimmer needs the camera to capture photos and videos straight into your private vault.
          Nothing is saved to your Photos library.
        </Text>
        <Pressable style={styles.btn} onPress={() => void requestCam()}>
          <Text style={styles.btnLabel}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={styles.fill}
        facing={facing}
        mode={mode}
        videoQuality="1080p"
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.topLabel}>Done</Text>
          </Pressable>
          <Text style={styles.topLabel}>Saves to vault only</Text>
          <Pressable onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} hitSlop={12}>
            <Text style={styles.topLabel}>Flip</Text>
          </Pressable>
        </View>
        <View style={styles.bottom}>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          {needsMic ? (
            <Pressable onPress={() => void requestMic()}>
              <Text style={styles.link}>Allow microphone to record sound</Text>
            </Pressable>
          ) : null}
          <View style={styles.modes}>
            {(['picture', 'video'] as const).map((m) => (
              <Pressable key={m} onPress={() => !recording && setMode(m)}>
                <Text style={[styles.mode, mode === m && styles.modeOn]}>
                  {m === 'picture' ? 'Photo' : 'Video'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.shutter, recording && styles.shutterRec]}
            onPress={() => void shoot()}
            accessibilityLabel={mode === 'picture' ? 'Take photo' : recording ? 'Stop recording' : 'Start recording'}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#0B0B0F', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  body: { color: '#B5B8C4', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  btn: { backgroundColor: '#6EE7B7', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  btnLabel: { color: '#07130E', fontSize: 16, fontWeight: '700' },
  link: { color: '#6EE7B7', fontSize: 14, textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  topLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  bottom: { alignItems: 'center', gap: 14, paddingBottom: 24 },
  note: { color: '#6EE7B7', fontSize: 13 },
  modes: { flexDirection: 'row', gap: 24 },
  mode: { color: '#9AA3B5', fontSize: 15, fontWeight: '600' },
  modeOn: { color: '#fff' },
  shutter: { width: 74, height: 74, borderRadius: 37, borderWidth: 5, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.25)' },
  shutterRec: { backgroundColor: '#F05252' },
});
