import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '@/constants/colors';
import { useThemedStyles } from '@/theme';

const POINTS = [
  ['🔒', 'Lock videos away', 'Move private videos out of Photos into a vault that opens only with Face ID or your passcode.'],
  ['🎧', 'Pull out the audio', 'Turn any video into an M4A file, right on your phone.'],
  ['💾', 'Back up on your terms', 'Export an encrypted vault file and keep it wherever you choose. No cloud, no account.'],
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const done = async () => {
    await AsyncStorage.setItem('playsz.welcomeSeen', '1');
    router.replace('/');
  };
  return (
    <SafeAreaView style={styles.safe} testID="welcome-screen">
      <View style={styles.body}>
        <Text style={styles.brand}>Playsz Vault</Text>
        <Text style={styles.tagline}>Your private video vault.</Text>
        {POINTS.map(([icon, title, text]) => (
          <View key={title} style={styles.row}>
            <Text style={styles.icon}>{icon}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{title}</Text>
              <Text style={styles.rowBody}>{text}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable style={styles.cta} onPress={done} testID="welcome-continue" accessibilityRole="button">
        <Text style={styles.ctaLabel}>Get started</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background, padding: 24 },
    body: { flex: 1, justifyContent: 'center' },
    brand: { color: c.accent, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
    tagline: { color: c.text, fontSize: 32, fontWeight: '800', marginTop: 6, marginBottom: 28 },
    row: { flexDirection: 'row', marginBottom: 22 },
    icon: { fontSize: 28, marginRight: 14 },
    rowText: { flex: 1 },
    rowTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
    rowBody: { color: c.textMuted, fontSize: 14, marginTop: 3, lineHeight: 20 },
    cta: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    ctaLabel: { color: c.background, fontSize: 17, fontWeight: '800' },
  });
